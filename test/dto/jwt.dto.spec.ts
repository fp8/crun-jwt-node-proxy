import '../testlib';

import { JwtValidator } from '../../src/dto/jwt.dto';
import { JwtConfig } from '../../src/dto/config.dto';
import { IJwtClaim } from '../../src/core/interfaces';

/**
 * Unit tests for JwtValidator class
 *
 * These tests verify the correct functionality of the JwtValidator class.
 * The JwtValidator properly stores filters as an array of IJwtMatcher objects
 * and validates JWT claims against the actual field names as intended.
 *
 * The validate() method throws errors when validation fails, providing
 * detailed error messages about what went wrong.
 *
 * The map() method converts JWT claim fields to the appropriate format:
 * - Strings and numbers: returned as-is (no quotes)
 * - Arrays: converted to comma-delimited strings
 * - Objects: JSON stringified
 * - Undefined fields: excluded from the result
 *
 * Test Coverage:
 * - Constructor initialization with various filter configurations
 * - Validation with string filters, regex filters, and array fields (throws on failure)
 * - Mapping functionality for JWT claim transformation with proper formatting
 * - Integration tests combining validation and mapping
 * - Edge cases including numeric values, mixed arrays, and complex objects
 */
describe('JwtValidator', () => {
  describe('constructor', () => {
    it('should initialize with empty filter and mapper when no config provided', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      expect(validator['filter']).toEqual([]);
      expect(validator['mapper']).toEqual({});
    });

    it('should initialize with string filters', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin', department: 'engineering' };
      config.mapper = { email: 'user_email' };

      const validator = new JwtValidator(config);

      expect(validator['filter']).toEqual([
        { field: 'role', value: 'admin' },
        { field: 'department', value: 'engineering' },
      ]);
      expect(validator['mapper']).toEqual({ email: 'user_email' });
    });

    it('should initialize with regex filters', () => {
      const config = new JwtConfig();
      config.filter = { email: '/.*@test\\.com$/' };

      const validator = new JwtValidator(config);

      expect(validator['filter']).toHaveLength(1);
      expect(validator['filter'][0].field).toBe('email');
      expect(validator['filter'][0].regex).toBeInstanceOf(RegExp);
      expect(validator['filter'][0].regex?.source).toBe('.*@test\\.com$');
    });

    it('should handle mixed string and regex filters', () => {
      const config = new JwtConfig();
      config.filter = {
        role: 'admin',
        email: '/.*@test\\.com$/',
        department: 'engineering',
      };

      const validator = new JwtValidator(config);

      expect(validator['filter']).toHaveLength(3);
      expect(validator['filter'][0]).toEqual({ field: 'role', value: 'admin' });
      expect(validator['filter'][1].field).toBe('email');
      expect(validator['filter'][1].regex).toBeInstanceOf(RegExp);
      expect(validator['filter'][2]).toEqual({
        field: 'department',
        value: 'engineering',
      });
    });
  });

  describe('validate', () => {
    it('should throw error when no JWT claim provided', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      expect(() => validator.validate(null as any)).toThrow(
        'No JWT claim provided for validation',
      );
      expect(() => validator.validate(undefined as any)).toThrow(
        'No JWT claim provided for validation',
      );
    });

    it('should not throw when no filters configured', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should validate string filters successfully', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'admin',
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should throw error when string filter does not match', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'user',
      };

      expect(() => validator.validate(claim)).toThrow(
        "Entry 'user' for 'role' failed matcher",
      );
    });

    it('should throw error when required field is missing', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      expect(() => validator.validate(claim)).toThrow(
        "No 'role' found in JWT claim",
      );
    });

    it('should validate regex filters successfully', () => {
      const config = new JwtConfig();
      config.filter = { email: '/.*@test\\.com$/' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should throw error when regex filter does not match', () => {
      const config = new JwtConfig();
      config.filter = { email: '/.*@test\\.com$/' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@other.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      expect(() => validator.validate(claim)).toThrow(
        "Entry 'user@other.com' for 'email' failed matcher",
      );
    });

    it('should validate array fields with string filters (any element matches)', () => {
      const config = new JwtConfig();
      config.filter = { roles: 'admin' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        roles: ['admin', 'user'], // Passes because 'admin' is in the array
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should throw error when array field does not contain matching value', () => {
      const config = new JwtConfig();
      config.filter = { roles: 'admin' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        roles: ['user', 'guest'], // Fails because 'admin' is not in the array
      };

      expect(() => validator.validate(claim)).toThrow(
        'Array ["user","guest"] did not match \'roles\'',
      );
    });

    it('should validate array fields with regex filters (any element matches)', () => {
      const config = new JwtConfig();
      config.filter = { groups: '/^dev-.*$/' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        groups: ['dev-frontend', 'dev-backend'], // Passes because both match the regex
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should validate array fields with regex filters when some elements match', () => {
      const config = new JwtConfig();
      config.filter = { groups: '/^dev-.*$/' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        groups: ['dev-frontend', 'qa-team'], // Passes because 'dev-frontend' matches
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should throw error when no array elements match regex', () => {
      const config = new JwtConfig();
      config.filter = { groups: '/^dev-.*$/' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        groups: ['qa-team', 'marketing'], // Fails because no elements match the regex
      };

      expect(() => validator.validate(claim)).toThrow(
        'Array ["qa-team","marketing"] did not match \'groups\'',
      );
    });

    it('should validate multiple filters successfully', () => {
      const config = new JwtConfig();
      config.filter = {
        role: 'admin',
        email: '/.*@test\\.com$/',
        department: 'engineering',
      };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'admin',
        department: 'engineering',
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });

    it('should throw error when one of multiple filters fails', () => {
      const config = new JwtConfig();
      config.filter = {
        role: 'admin',
        email: '/.*@test\\.com$/',
        department: 'engineering',
      };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'admin',
        department: 'marketing',
      };

      expect(() => validator.validate(claim)).toThrow(
        "Entry 'marketing' for 'department' failed matcher",
      );
    });

    it('should handle numeric values in filters', () => {
      const config = new JwtConfig();
      config.filter = { level: '5' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        level: 5,
      };

      expect(() => validator.validate(claim)).not.toThrow();
    });
  });

  describe('map', () => {
    it('should return empty object when no JWT claim provided', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      expect(validator.map(null as any)).toEqual({});
      expect(validator.map(undefined as any)).toEqual({});
    });

    it('should return empty object when no mapper configured', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      expect(validator.map(claim)).toEqual({});
    });

    it('should map string fields correctly', () => {
      const config = new JwtConfig();
      config.mapper = { email: 'user_email', sub: 'user_id' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        user_email: 'user@test.com',
        user_id: 'test-subject',
      });
    });

    it('should map numeric fields correctly', () => {
      const config = new JwtConfig();
      config.mapper = { iat: 'issued_at', exp: 'expires_at' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        issued_at: '1234567890',
        expires_at: '1234567890',
      });
    });

    it('should map array fields correctly', () => {
      const config = new JwtConfig();
      config.mapper = { roles: 'user_roles' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        roles: ['admin', 'user'],
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        user_roles: 'admin,user',
      });
    });

    it('should handle undefined fields in mapping by excluding them', () => {
      const config = new JwtConfig();
      config.mapper = {
        email: 'user_email',
        nonexistent: 'missing_field',
      };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        user_email: 'user@test.com',
        // missing_field is not included because the source field doesn't exist
      });
    });

    it('should map complex object fields correctly', () => {
      const config = new JwtConfig();
      config.mapper = { customData: 'custom_data' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        customData: { nested: 'value', count: 42 } as any,
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        custom_data: '{"nested":"value","count":42}',
      });
    });

    it('should not include undefined fields in mapping result', () => {
      const config = new JwtConfig();
      config.mapper = {
        existing: 'mapped_existing',
        missing1: 'mapped_missing1',
        missing2: 'mapped_missing2',
      };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        existing: 'value',
        // missing1 and missing2 are not present
      };

      const result = validator.map(claim);

      // Should only include the existing field
      expect(result).toEqual({
        mapped_existing: 'value',
      });

      // Explicitly verify the missing fields are not included
      expect(result).not.toHaveProperty('mapped_missing1');
      expect(result).not.toHaveProperty('mapped_missing2');
    });

    it('should map array fields with mixed types correctly', () => {
      const config = new JwtConfig();
      config.mapper = { mixed: 'mixed_values' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        mixed: ['admin', 123, 'user'] as any,
      };

      const result = validator.map(claim);

      expect(result).toEqual({
        mixed_values: 'admin,123,user',
      });
    });
  });

  describe('integration tests', () => {
    it('should validate and map JWT claim successfully', () => {
      const config = new JwtConfig();
      config.filter = {
        role: 'admin',
        email: '/.*@test\\.com$/',
      };
      config.mapper = {
        email: 'user_email',
        role: 'user_role',
      };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'admin@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'admin',
      };

      expect(() => validator.validate(claim)).not.toThrow();

      const mapped = validator.map(claim);
      expect(mapped).toEqual({
        user_email: 'admin@test.com',
        user_role: 'admin',
      });
    });

    it('should throw error during validation but still allow mapping', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };
      config.mapper = { email: 'user_email' };

      const validator = new JwtValidator(config);

      const claim: IJwtClaim = {
        iss: 'test-issuer',
        aud: 'test-audience',
        sub: 'test-subject',
        email: 'user@test.com',
        iat: 1234567890,
        exp: 1234567890,
        role: 'user',
      };

      expect(() => validator.validate(claim)).toThrow(
        "Entry 'user' for 'role' failed matcher",
      );

      const mapped = validator.map(claim);
      expect(mapped).toEqual({
        user_email: 'user@test.com',
      });
    });
  });
});
