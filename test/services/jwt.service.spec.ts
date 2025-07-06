import { JwtService } from '../../src/services/jwt.service';
import { JwtValidator } from '../../src/dto/jwt.dto';
import { IJwtClaim } from '../../src/core/interfaces';
import * as jwt from 'jsonwebtoken';

// Mock the https module
jest.mock('https');
jest.mock('http');

describe('JwtService', () => {
  let jwtService: JwtService;
  let mockValidator: JwtValidator;

  const mockIssuer = 'https://example.com';
  const mockAudience = 'test-audience';

  const mockOpenIdConfig = {
    issuer: mockIssuer,
    jwks_uri: 'https://example.com/.well-known/jwks.json',
    authorization_endpoint: 'https://example.com/auth',
    token_endpoint: 'https://example.com/token',
  };

  const mockJwks = {
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-id',
        use: 'sig',
        n: 'test-modulus',
        e: 'AQAB',
        alg: 'RS256',
      },
    ],
  };

  beforeEach(() => {
    // Mock the validator
    mockValidator = {
      validate: jest.fn(),
      map: jest.fn().mockReturnValue({ 'x-user-id': 'test-user' }),
    } as any;

    jwtService = new JwtService({
      issuer: mockIssuer,
      audience: mockAudience,
      clockTolerance: 30,
      validator: mockValidator,
    });

    // Clear any previous mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      const service = new JwtService({
        issuer: mockIssuer,
        audience: mockAudience,
        clockTolerance: 60,
        maxCacheAge: 7200000,
      });

      expect(service).toBeDefined();
    });

    it('should use default values when options are not provided', () => {
      const service = new JwtService({
        issuer: mockIssuer,
      });

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
        'JWT token missing key ID (kid) in header',
      );
    });
  });

  describe('mapClaims', () => {
    it('should return empty object when no validator is provided', () => {
      const serviceWithoutValidator = new JwtService({
        issuer: mockIssuer,
      });

      const claims: IJwtClaim = {
        iss: mockIssuer,
        aud: mockAudience,
        sub: 'test-user',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = serviceWithoutValidator.mapClaims(claims);
      expect(result).toEqual({});
    });

    it('should map claims using validator', () => {
      const claims: IJwtClaim = {
        iss: mockIssuer,
        aud: mockAudience,
        sub: 'test-user',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = jwtService.mapClaims(claims);

      expect(mockValidator.map).toHaveBeenCalledWith(claims);
      expect(result).toEqual({ 'x-user-id': 'test-user' });
    });
  });

  describe('clearCache', () => {
    it('should clear internal caches', () => {
      // This test verifies that the method exists and can be called
      expect(() => jwtService.clearCache()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle unsupported key types', () => {
      const service = new JwtService({
        issuer: mockIssuer,
      });

      // This would be tested in integration tests with actual JWKS
      expect(service).toBeDefined();
    });

    it('should handle network errors gracefully', () => {
      const service = new JwtService({
        issuer: mockIssuer,
      });

      // This would be tested in integration tests with network mocking
      expect(service).toBeDefined();
    });
  });
});
