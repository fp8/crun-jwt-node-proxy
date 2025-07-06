import * as jwt from 'jsonwebtoken';
import { IJwtClaim, IJwtValidationOptions } from '../core/interfaces';
import { createLogger } from '../core/logger';
import {
  JwtValidator,
} from '../jwt/validator';
import {
  JwtServiceOptions,
  OpenIdConfiguration
} from 'jwt/interfaces';
import { discoverJwksUri, fetchJwks, rsaJwkToPem } from '../jwt/utils';

const logger = createLogger('JwtService');

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
      let publicKey = options?.publicKey;
      if (publicKey === undefined) {
        publicKey = await this.getPublicKey(keyId);
      }

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
      this.jwksUri = await discoverJwksUri(this.issuer);
    }

    // Fetch JWKS and find the key
    const jwks = await fetchJwks(this.jwksUri);
    const jwkKey = jwks.keys.find((key) => key.kid === keyId);

    if (!jwkKey) {
      throw new Error(`Public key not found for key ID: ${keyId}`);
    }

    // Convert JWK to PEM format
    const publicKey = rsaJwkToPem(jwkKey);

    // Cache the key
    this.keyCache.set(keyId, {
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
    this.configCache = undefined;
    this.jwksUri = undefined;
    logger.debug('JWT service cache cleared');
  }
}
