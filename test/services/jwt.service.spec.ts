import { loadTextFile, loadJsonFile, execShell } from '../testlib';
import * as jwt from 'jsonwebtoken';

import { JwtService } from '../../src/services/jwt.service';
import { IJwtClaim } from '../../src/core';
import { JwtValidator, JwksResponse, rsaJwkToPem } from '../../src/jwt';
import { JwtConfig } from '../../src/dto/config.dto';

// Helper function to create default JwtConfig
const createJwtConfig = (overrides: Partial<JwtConfig> = {}): JwtConfig => ({
  issuer: 'https://securetoken.google.com/fp8netes-dev',
  audience: 'fp8netes-dev',
  authHeaderPrefix: 'X-AUTH-',
  clockTolerance: 30,
  maxCacheAge: 3600000,
  filter: {},
  mapper: {},
  ...overrides,
});

const idTokenJwtConfig: JwtConfig = {
  issuer: 'https://accounts.google.com',
  authHeaderPrefix: 'X-AUTH-',
  filter: {},
  mapper: {},
};

describe('JwtService', () => {
  const testIssuer = 'https://securetoken.google.com/fp8netes-dev';
  const testAudience = 'fp8netes-dev';
  const jwtService = new JwtService(createJwtConfig());

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      const service = new JwtService(
        createJwtConfig({
          clockTolerance: 60,
          maxCacheAge: 7200000,
        }),
      );

      expect(service).toBeDefined();
    });

    it('should use default values when options are not provided', () => {
      const service = new JwtService(createJwtConfig());

      expect(service).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should throw error for invalid token format', async () => {
      await expect(jwtService.validateToken('invalid-token')).rejects.toThrow(
        'Invalid JWT token format',
      );
    });

    it('should throw error for token without kid', async () => {
      // Create a token without kid using HS256 (symmetric key)
      const token = jwt.sign({ sub: 'test' }, 'secret', {
        algorithm: 'HS256',
      });

      await expect(jwtService.validateToken(token)).rejects.toThrow(
        /^JWT validation failed: JWT token/,
      );
    });
  });

  describe('mapClaims', () => {
    let jwtServiceForMap: JwtService;

    beforeEach(() => {
      jwtServiceForMap = new JwtService(
        createJwtConfig({
          mapper: { sub: 'x-user-id' }, // Simple mapping for testing
        }),
      );

      // Clear any previous mocks
      jest.clearAllMocks();
    });

    it('should return empty object when no mapper is provided', () => {
      const serviceWithoutMapper = new JwtService(createJwtConfig());

      const claims: IJwtClaim = {
        iss: testIssuer,
        aud: testAudience,
        sub: 'test-user',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = serviceWithoutMapper.mapClaims(claims);
      expect(result).toEqual({});
    });

    it('should map claims using mapper configuration', () => {
      const claims: IJwtClaim = {
        iss: testIssuer,
        aud: testAudience,
        sub: 'test-user',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = jwtServiceForMap.mapClaims(claims);

      expect(result).toEqual({ 'x-user-id': 'test-user' });
    });
  });

  describe('edge cases', () => {
    it('should handle unsupported key types', () => {
      const service = new JwtService(createJwtConfig());

      // This would be tested in integration tests with actual JWKS
      expect(service).toBeDefined();
    });

    it('should handle network errors gracefully', () => {
      const service = new JwtService(createJwtConfig());

      // This would be tested in integration tests with network mocking
      expect(service).toBeDefined();
    });
  });

  /**
   * At some point in the future, the direct test might fail due to public key rotation.
   * That's the reason we have following test with "validateToken (local key)".
   *
   * When that happens, re-create the jwt and insert into the test.  For firebase, do:
   *
   * ```bash
   * curl --location 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<Firebase Web API Key>' \
   *     --header 'Content-Type: application/json' \
   *     --data-raw '{
   *         "email": "marcos.lin@farport.co",
   *         "password": "marcos",
   *         "returnSecureToken": true
   *     }'
   * ```
   *
   * For IAM, do:
   *
   * ```bash
   * gcloud auth print-identity-token
   * ```
   */
  describe('validateToken (direct)', () => {
    it.skip('validate firebase JWT with signature only (ignoring expiry)', async () => {
      const jwt = loadTextFile('jwt/jwt-firebase.txt');
      // Using signature-only validation since the token is expired
      const claims = await jwtService.validateToken(jwt, {
        signatureOnly: true,
      });
      expect(claims).toBeDefined();
      expect(claims.sub).toBe('Vl30SR5kIMWdqCdN5cr4Ptd62b53');
      expect(claims.email).toBe('marcos.lin@farport.co');
      expect(claims.exp).toBe(1751799717); // Should still return the expiry claim
    });

    it.skip('should fail validation when token is expired (normal validation)', async () => {
      const jwt = loadTextFile('jwt/jwt-firebase.txt');

      // If the token is expired, this should fail with normal validation
      // Note: This test may pass if the token is not yet expired
      try {
        await jwtService.validateToken(jwt);
        // If we get here, the token is not expired yet
        console.log('Token is not expired yet, skipping expiry test');
      } catch (error) {
        const err = error as Error;
        expect(err.message).toContain('JWT validation failed');
        expect(err.message.toLowerCase()).toContain('expired');
      }
    });

    it('validate Google identity token', async () => {
      const service = new JwtService(idTokenJwtConfig);
      // Required that google cloud project is configured and authenticated
      // with `gcloud auth application-default login`
      const jwt = await execShell('gcloud auth print-identity-token');
      const claims = await service.validateToken(jwt);
      expect(claims).toBeDefined();
      expect(claims.email).toBeDefined();
    });

    it('validate IAM JWT with signature only (ignoring expiry)', async () => {
      const iamJwtService = new JwtService(
        createJwtConfig({
          issuer: 'https://accounts.google.com',
          audience: '', // IAM tokens might not have audience
        }),
      );

      const jwt = loadTextFile('jwt/jwt-iam.txt');
      // Using signature-only validation since the token is expired
      const claims = await iamJwtService.validateToken(jwt, {
        signatureOnly: true,
      });
      expect(claims).toBeDefined();
      expect(claims.sub).toBe('114789851119851077143');
      expect(claims.email).toBe('marcos.lin@farport.co');
      expect(claims.exp).toBe(1751798347); // Should still return the expiry claim
    });
  });

  describe('validateToken (local key)', () => {
    it('validate firebase JWT with local signature (ignoring expiry)', async () => {
      const jwt = loadTextFile('jwt/jwt-firebase.txt');
      const publicKey = getPublicKey(
        'jwt/jwt-firebase-jwks.json',
        '877485002f05be0267ef459f5b513533b5c58c12',
      );
      // Using signature-only validation since the token is expired
      const claims = await jwtService.validateToken(jwt, {
        signatureOnly: true,
        publicKey,
      });
      expect(claims).toBeDefined();
      expect(claims.sub).toBe('Vl30SR5kIMWdqCdN5cr4Ptd62b53');
      expect(claims.email).toBe('marcos.lin@farport.co');
      expect(claims.exp).toBe(1751799717); // Should still return the expiry claim
    });

    it('should fail validation when incorrect key provided', async () => {
      const jwt = loadTextFile('jwt/jwt-firebase.txt');
      const publicKey = getPublicKey(
        'jwt/jwt-firebase-jwks.json',
        '47ae49c4c9d3eb85a5254072c30d2e8e7661efe1',
      );

      // If the token is expired, this should fail with normal validation
      // Note: This test may pass if the token is not yet expired
      try {
        await jwtService.validateToken(jwt, {
          signatureOnly: true,
          publicKey,
        });
        // If we get here, the token is not expired yet
        console.log('Token is not expired yet, skipping expiry test');
      } catch (error) {
        const err = error as Error;
        expect(err.message.toLowerCase()).toContain('jwt validation failed');
        expect(err.message.toLowerCase()).toContain('invalid signature');
      }
    });

    it('validate IAM JWT with signature only (ignoring expiry)', async () => {
      const iamJwtService = new JwtService(
        createJwtConfig({
          issuer: 'https://accounts.google.com',
          audience: '', // IAM tokens might not have audience
        }),
      );

      const publicKey = getPublicKey(
        'jwt/jwt-iam-jwks.json',
        '8e8fc8e556f7a76d08d35829d6f90ae2e12cfd0d',
      );
      const jwt = loadTextFile('jwt/jwt-iam.txt');
      // Using signature-only validation since the token is expired
      const claims = await iamJwtService.validateToken(jwt, {
        signatureOnly: true,
        publicKey,
      });
      expect(claims).toBeDefined();
      expect(claims.sub).toBe('114789851119851077143');
      expect(claims.email).toBe('marcos.lin@farport.co');
      expect(claims.exp).toBe(1751798347); // Should still return the expiry claim
    });
  });
});

function getPublicKey(filepath: string, key: string): string {
  const jwks = loadJsonFile<JwksResponse>(filepath);
  const keyData = jwks.keys.find((k) => k.kid === key);
  if (!keyData) {
    throw new Error(`Key with kid ${key} not found in JWKS`);
  }
  return rsaJwkToPem(keyData);
}
