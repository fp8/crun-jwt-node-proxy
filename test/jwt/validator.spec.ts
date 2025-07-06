import '../testlib';

import { JwtValidator } from '../../src/jwt/validator';
import { JwtConfig } from '../../src/dto/config.dto';
import { IJwtClaim } from '../../src/core/interfaces';

/**
 * Unit tests for JwtValidator class
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

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        role: 'user',
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });

    it('should validate string filters successfully', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin', department: 'engineering' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        role: 'admin',
        department: 'engineering',
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });

    it('should throw error when string filter does not match', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        role: 'user',
      };

      expect(() => validator.validate(mockClaim)).toThrow(
        "Entry 'user' for 'role' failed matcher",
      );
    });

    it('should throw error when field is missing', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
      };

      expect(() => validator.validate(mockClaim)).toThrow(
        "No 'role' found in JWT claim",
      );
    });

    it('should validate regex filters successfully', () => {
      const config = new JwtConfig();
      config.filter = { email: '/.*@test\\.com$/' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'user@test.com',
        exp: 123456789,
        iat: 123456789,
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });

    it('should throw error when regex filter does not match', () => {
      const config = new JwtConfig();
      config.filter = { email: '/.*@test\\.com$/' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'user@example.com',
        exp: 123456789,
        iat: 123456789,
      };

      expect(() => validator.validate(mockClaim)).toThrow(
        "Entry 'user@example.com' for 'email' failed matcher",
      );
    });

    it('should validate array fields with OR logic (any match)', () => {
      const config = new JwtConfig();
      config.filter = { roles: 'admin' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        roles: ['user', 'admin', 'editor'],
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });

    it('should throw error when array field has no matches', () => {
      const config = new JwtConfig();
      config.filter = { roles: 'admin' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        roles: ['user', 'editor'],
      };

      expect(() => validator.validate(mockClaim)).toThrow(
        'Array ["user","editor"] did not match \'roles\'',
      );
    });

    it('should validate numeric values with loose equality', () => {
      const config = new JwtConfig();
      config.filter = { level: '5' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        level: 5,
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });

    it('should validate array fields with regex patterns', () => {
      const config = new JwtConfig();
      config.filter = { groups: '/^admin-.*/' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        groups: ['user-group', 'admin-group', 'editor-group'],
      };

      expect(() => validator.validate(mockClaim)).not.toThrow();
    });
  });

  describe('map', () => {
    it('should return empty object when no JWT claim provided', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      const result = validator.map(null as any);
      expect(result).toEqual({});

      const result2 = validator.map(undefined as any);
      expect(result2).toEqual({});
    });

    it('should return empty object when no mapper configured', () => {
      const config = new JwtConfig();
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'user@test.com',
        exp: 123456789,
        iat: 123456789,
      };

      const result = validator.map(mockClaim);
      expect(result).toEqual({});
    });

    it('should map string values correctly', () => {
      const config = new JwtConfig();
      config.mapper = { email: 'user_email', sub: 'user_id' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test-user',
        iss: 'test',
        aud: 'test',
        email: 'user@test.com',
        exp: 123456789,
        iat: 123456789,
      };

      const result = validator.map(mockClaim);
      expect(result).toEqual({
        user_email: 'user@test.com',
        user_id: 'test-user',
      });
    });

    it('should map numeric values correctly', () => {
      const config = new JwtConfig();
      config.mapper = { level: 'user_level', iat: 'issued_at' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        level: 5,
      };

      const result = validator.map(mockClaim);
      expect(result).toEqual({
        user_level: '5',
        issued_at: '123456789',
      });
    });

    it('should map array values to comma-delimited strings', () => {
      const config = new JwtConfig();
      config.mapper = { roles: 'user_roles', groups: 'user_groups' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'test@example.com',
        exp: 123456789,
        iat: 123456789,
        roles: ['admin', 'user', 'editor'],
        groups: ['engineering', 'product'],
      };

      const result = validator.map(mockClaim);
      expect(result).toEqual({
        user_roles: 'admin,user,editor',
        user_groups: 'engineering,product',
      });
    });

    it('should handle mixed value types', () => {
      const config = new JwtConfig();
      config.mapper = {
        email: 'user_email',
        roles: 'user_roles',
        level: 'user_level',
      };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test',
        iss: 'test',
        aud: 'test',
        email: 'user@test.com',
        exp: 123456789,
        iat: 123456789,
        roles: ['admin', 'user'],
        level: 5,
      };

      const result = validator.map(mockClaim);
      expect(result).toEqual({
        user_email: 'user@test.com',
        user_roles: 'admin,user',
        user_level: '5',
      });
    });
  });

  describe('integration tests', () => {
    it('should validate and map claims together', () => {
      const config = new JwtConfig();
      config.filter = { role: 'admin', email: '/.*@test\\.com$/' };
      config.mapper = { email: 'user_email', sub: 'user_id' };
      const validator = new JwtValidator(config);

      const mockClaim: IJwtClaim = {
        sub: 'test-user',
        iss: 'test',
        aud: 'test',
        email: 'user@test.com',
        exp: 123456789,
        iat: 123456789,
        role: 'admin',
      };

      // Should not throw during validation
      expect(() => validator.validate(mockClaim)).not.toThrow();

      // Should map correctly
      const result = validator.map(mockClaim);
      expect(result).toEqual({
        user_email: 'user@test.com',
        user_id: 'test-user',
      });
    });
  });
});
