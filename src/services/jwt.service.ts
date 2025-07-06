import * as jwt from 'jsonwebtoken';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { IJwtClaim, IJwtValidationOptions } from '../core/interfaces';
import { createLogger } from '../core/logger';
import { JwtValidator } from '../dto/jwt.dto';

const logger = createLogger('JwtService');

interface JwksKey {
  kty: string;
  kid: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  x5t?: string;
  alg?: string;
}

interface JwksResponse {
  keys: JwksKey[];
}

interface OpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  // Add other OIDC discovery properties as needed
}

export interface JwtServiceOptions {
  issuer: string;
  audience?: string;
  clockTolerance?: number;
  maxCacheAge?: number;
  validator?: JwtValidator;
}

export class JwtService {
  private readonly issuer: string;
  private readonly audience?: string;
  private readonly clockTolerance: number;
  private readonly maxCacheAge: number;
  private readonly validator?: JwtValidator;

  private jwksUri?: string;
  private keyCache: Map<string, { key: string; cachedAt: number }> = new Map();
  private configCache?: { config: OpenIdConfiguration; cachedAt: number };

  constructor(options: JwtServiceOptions) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockTolerance = options.clockTolerance || 30; // 30 seconds tolerance
    this.maxCacheAge = options.maxCacheAge || 3600000; // 1 hour in milliseconds
    this.validator = options.validator;
  }

  /**
   * Validates a JWT token and returns the parsed claims
   * @param token - The JWT token to validate
   * @param options - Optional validation options
   * @returns Promise<IJwtClaim> - The validated JWT claims
   */
  public async validateToken(
    token: string,
    options?: IJwtValidationOptions,
  ): Promise<IJwtClaim> {
    try {
      // Decode the token header to get the key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid JWT token format');
      }

      const { header } = decoded;
      const keyId = header.kid;

      if (!keyId) {
        throw new Error('JWT token missing key ID (kid) in header');
      }

      // Get the public key for validation
      const publicKey = await this.getPublicKey(keyId);

      // Verify the token
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.issuer,
        clockTolerance: this.clockTolerance,
      };

      if (this.audience) {
        verifyOptions.audience = this.audience;
      }

      // If signatureOnly is true, ignore expiry validation
      if (options?.signatureOnly) {
        verifyOptions.ignoreExpiration = true;
      }

      const claims = jwt.verify(token, publicKey, verifyOptions) as IJwtClaim;

      // Additional validation using the configured validator
      if (this.validator) {
        this.validator.validate(claims);
      }

      logger.debug('JWT token validated successfully', {
        sub: claims.sub,
        iss: claims.iss,
        exp: claims.exp,
        signatureOnly: options?.signatureOnly || false,
      });

      return claims;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('JWT validation failed', { error: errorMessage });
      throw new Error(`JWT validation failed: ${errorMessage}`);
    }
  }

  /**
   * Maps JWT claims using the configured validator
   * @param claims - The JWT claims to map
   * @returns Record<string, string> - The mapped claims
   */
  public mapClaims(claims: IJwtClaim): Record<string, string> {
    if (!this.validator) {
      return {};
    }
    return this.validator.map(claims);
  }

  /**
   * Gets the public key for a given key ID
   * @param keyId - The key ID to retrieve
   * @returns Promise<string> - The public key in PEM format
   */
  private async getPublicKey(keyId: string): Promise<string> {
    // Check cache first
    const cached = this.keyCache.get(keyId);
    if (cached && Date.now() - cached.cachedAt < this.maxCacheAge) {
      logger.debug('Using cached public key', { keyId });
      return cached.key;
    }

    // Get JWKS URI if not cached
    if (!this.jwksUri) {
      await this.discoverJwksUri();
    }

    // Fetch JWKS and find the key
    const jwks = await this.fetchJwks();
    const jwkKey = jwks.keys.find((key) => key.kid === keyId);

    if (!jwkKey) {
      throw new Error(`Public key not found for key ID: ${keyId}`);
    }

    // Convert JWK to PEM format
    const publicKey = this.jwkToPem(jwkKey);

    // Cache the key
    this.keyCache.set(keyId, {
      key: publicKey,
      cachedAt: Date.now(),
    });

    logger.debug('Retrieved and cached public key', { keyId });
    return publicKey;
  }

  /**
   * Discovers the JWKS URI from the OpenID Connect configuration
   */
  private async discoverJwksUri(): Promise<void> {
    // Check if configuration is cached
    if (
      this.configCache &&
      Date.now() - this.configCache.cachedAt < this.maxCacheAge
    ) {
      this.jwksUri = this.configCache.config.jwks_uri;
      return;
    }

    const wellKnownUrl = `${this.issuer}/.well-known/openid-configuration`;

    try {
      const config = await this.fetchJson<OpenIdConfiguration>(wellKnownUrl);

      if (!config.jwks_uri) {
        throw new Error('JWKS URI not found in OpenID configuration');
      }

      this.jwksUri = config.jwks_uri;
      this.configCache = {
        config,
        cachedAt: Date.now(),
      };

      logger.debug('Discovered JWKS URI', {
        issuer: this.issuer,
        jwksUri: this.jwksUri,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to discover JWKS URI', {
        issuer: this.issuer,
        error: errorMessage,
      });
      throw new Error(`Failed to discover JWKS URI: ${errorMessage}`);
    }
  }

  /**
   * Fetches the JWKS from the JWKS URI
   */
  private async fetchJwks(): Promise<JwksResponse> {
    if (!this.jwksUri) {
      throw new Error('JWKS URI not available');
    }

    try {
      const jwks = await this.fetchJson<JwksResponse>(this.jwksUri);
      logger.debug('Fetched JWKS successfully', {
        keyCount: jwks.keys.length,
        jwksUri: this.jwksUri,
      });
      return jwks;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch JWKS', {
        jwksUri: this.jwksUri,
        error: errorMessage,
      });
      throw new Error(`Failed to fetch JWKS: ${errorMessage}`);
    }
  }

  /**
   * Converts a JWK to PEM format
   */
  private jwkToPem(jwk: JwksKey): string {
    if (jwk.kty !== 'RSA') {
      throw new Error(`Unsupported key type: ${jwk.kty}`);
    }

    if (!jwk.n || !jwk.e) {
      throw new Error('Invalid RSA key: missing n or e parameters');
    }

    // Convert base64url to buffer
    const nBuffer = Buffer.from(jwk.n, 'base64url');
    const eBuffer = Buffer.from(jwk.e, 'base64url');

    // Create ASN.1 DER encoded public key
    const publicKeyDer = this.createRsaPublicKeyDer(nBuffer, eBuffer);

    // Convert to PEM format
    const publicKeyPem = this.derToPem(publicKeyDer, 'PUBLIC KEY');

    return publicKeyPem;
  }

  /**
   * Creates RSA public key in DER format
   */
  private createRsaPublicKeyDer(n: Buffer, e: Buffer): Buffer {
    // RSA public key ASN.1 structure
    const modulusLength = this.encodeLength(n.length);
    const exponentLength = this.encodeLength(e.length);

    const modulus = Buffer.concat([Buffer.from([0x02]), modulusLength, n]);
    const exponent = Buffer.concat([Buffer.from([0x02]), exponentLength, e]);

    const rsaPublicKey = Buffer.concat([modulus, exponent]);
    const rsaPublicKeyLength = this.encodeLength(rsaPublicKey.length);

    const sequence = Buffer.concat([
      Buffer.from([0x30]),
      rsaPublicKeyLength,
      rsaPublicKey,
    ]);

    // RSA encryption OID
    const rsaOid = Buffer.from([
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
      0x01, 0x05, 0x00,
    ]);

    const publicKeyInfo = Buffer.concat([
      rsaOid,
      Buffer.from([0x03]),
      this.encodeLength(sequence.length + 1),
      Buffer.from([0x00]),
      sequence,
    ]);

    const publicKeyInfoLength = this.encodeLength(publicKeyInfo.length);

    return Buffer.concat([
      Buffer.from([0x30]),
      publicKeyInfoLength,
      publicKeyInfo,
    ]);
  }

  /**
   * Encodes length in ASN.1 DER format
   */
  private encodeLength(length: number): Buffer {
    if (length < 0x80) {
      return Buffer.from([length]);
    } else if (length < 0x100) {
      return Buffer.from([0x81, length]);
    } else if (length < 0x10000) {
      return Buffer.from([0x82, length >> 8, length & 0xff]);
    } else if (length < 0x1000000) {
      return Buffer.from([
        0x83,
        length >> 16,
        (length >> 8) & 0xff,
        length & 0xff,
      ]);
    } else {
      return Buffer.from([
        0x84,
        length >> 24,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff,
      ]);
    }
  }

  /**
   * Converts DER to PEM format
   */
  private derToPem(der: Buffer, type: string): string {
    const base64 = der.toString('base64');
    const pem = base64.match(/.{1,64}/g)?.join('\n') || base64;
    return `-----BEGIN ${type}-----\n${pem}\n-----END ${type}-----\n`;
  }

  /**
   * Fetches JSON from a URL
   */
  private async fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'crun-jwt-proxy/0.1.0',
        },
        timeout: 10000, // 10 seconds timeout
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              reject(
                new Error(`Failed to parse JSON response: ${errorMessage}`),
              );
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Clears the internal caches
   */
  public clearCache(): void {
    this.keyCache.clear();
    this.configCache = undefined;
    this.jwksUri = undefined;
    logger.debug('JWT service cache cleared');
  }
}
