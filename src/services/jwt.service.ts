import * as jwt from 'jsonwebtoken';
import {
  createLogger,
  getShortenedString,
  IJwtClaim,
  IJwtValidationOptions,
} from '../core';
import { JwtConfig } from 'dto/config.dto';
import { JwtValidator, discoverJwksUri, fetchJwks, rsaJwkToPem } from '../jwt';

const logger = createLogger('JwtService');

export class JwtService {
  private readonly issuer: string;
  private readonly audience: string | undefined;
  private readonly clockTolerance: number;
  private readonly maxCacheAge: number;
  private readonly validator: JwtValidator;

  private keyCache: Map<string, { key: string; cachedAt: number }> = new Map();

  constructor(config: JwtConfig) {
    this.issuer = config.issuer;
    this.audience = config.audience;
    this.clockTolerance = config.clockTolerance || 30; // 30 seconds tolerance
    this.maxCacheAge = config.maxCacheAge || 3600000; // 1 hour in milliseconds
    this.validator = new JwtValidator(config);
  }

  /**
   * Validates a JWT token and returns the parsed claims
   * @param token - The JWT token to validate
   * @param options - Optional validation options
   * @returns Promise<IJwtClaim> - The validated JWT claims
   */
  public async validateToken(
    token: string | undefined,
    options?: IJwtValidationOptions,
  ): Promise<IJwtClaim> {
    try {
      if (token === undefined) {
        throw new Error('JWT token is undefined');
      }

      // Decode the token header to get the key ID
      const shortToken = getShortenedString(token, 25);
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid JWT token format');
      }

      const { header, payload } = decoded;
      const keyId = header.kid;

      let issuer: string | undefined;

      if (typeof payload === 'string') {
        const json = JSON.parse(payload);
        issuer = json.iss;
      } else {
        issuer = payload.iss;
      }

      if (!issuer) {
        throw new Error(`JWT token ${shortToken} missing issuer (iss) claim`);
      }

      if (!keyId) {
        throw new Error(
          `JWT token ${shortToken} missing key ID (kid) in header`,
        );
      }

      // Get the public key for validation
      let publicKey = options?.publicKey;
      if (publicKey === undefined) {
        publicKey = await this.getPublicKey(keyId, issuer);
      }

      // Verify the token
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
      };

      // If signatureOnly is true, ignore expiry validation
      if (options?.signatureOnly) {
        logger.debug(
          `JWT token ${shortToken} validation with signature only, ignoring expiration`,
        );
        verifyOptions.ignoreExpiration = true;
      }

      logger.info(`Validating JWT with claim ${JSON.stringify(payload)}`);
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
  private async getPublicKey(keyId: string, issuer: string): Promise<string> {
    // Check cache first
    const cachedKey = `${issuer}:${keyId}`;
    const cached = this.keyCache.get(cachedKey);
    if (cached && Date.now() - cached.cachedAt < this.maxCacheAge) {
      logger.debug('Using cached public key', { keyId });
      return cached.key;
    }

    // Get JWKS URI if not cached
    const jwksUri = await discoverJwksUri(issuer);

    // Fetch JWKS and find the key
    const jwks = await fetchJwks(jwksUri);
    const jwkKey = jwks.keys.find((key) => key.kid === keyId);

    if (!jwkKey) {
      throw new Error(`Public key not found for key ID: ${keyId}`);
    }

    // Convert JWK to PEM format
    const publicKey = rsaJwkToPem(jwkKey);

    // Cache the key
    this.keyCache.set(cachedKey, {
      key: publicKey,
      cachedAt: Date.now(),
    });

    logger.debug('Retrieved and cached public key', { keyId });
    return publicKey;
  }

  /**
   * Clears the internal caches
   */
  public clearCache(): void {
    this.keyCache.clear();
    logger.debug('JWT service cache cleared');
  }
}
