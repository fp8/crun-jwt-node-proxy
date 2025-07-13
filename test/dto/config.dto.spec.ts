import 'reflect-metadata';
import { validate } from 'class-validator';
import { JwtConfig } from '../../src/dto/config.dto';

describe('JwtConfig', () => {
  describe('mapper validation', () => {
    it('should pass validation when mapper values start with authHeaderPrefix', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'X-AUTH-';
      config.mapper = {
        email: 'X-AUTH-EMAIL',
        role: 'X-AUTH-ROLE',
        sub: 'X-AUTH-USER-ID',
      };

      const errors = await validate(config);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when mapper values do not start with authHeaderPrefix', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'X-AUTH-';
      config.mapper = {
        email: 'X-AUTH-EMAIL',
        role: 'X-INVALID-ROLE', // This should fail validation
        sub: 'X-AUTH-USER-ID',
      };

      const errors = await validate(config);
      console.log(errors);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('mapper');
      expect(errors[0].constraints?.isMapperKeysValid).toBe(
        'Mapper value X-INVALID-ROLE must start with X-AUTH-',
      );
    });

    it('should fail validation when multiple mapper values do not start with authHeaderPrefix', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'X-AUTH-';
      config.mapper = {
        email: 'INVALID-EMAIL',
        role: 'INVALID-ROLE',
        sub: 'X-AUTH-USER-ID',
      };

      const errors = await validate(config);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('mapper');
      expect(errors[0].constraints?.isMapperKeysValid).toBe(
        'Mapper value INVALID-EMAIL must start with X-AUTH-',
      );
    });

    it('should pass validation when mapper is empty', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'X-AUTH-';
      config.mapper = {};

      const errors = await validate(config);
      expect(errors).toHaveLength(0);
    });

    it('should handle non-empty authHeaderPrefix correctly', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'X-CUSTOM-';
      config.mapper = {
        email: 'X-CUSTOM-EMAIL',
        role: 'X-CUSTOM-ROLE',
      };

      const errors = await validate(config);
      expect(errors).toHaveLength(0);
    });

    it('should be case-insensitive for prefix matching', async () => {
      const config = new JwtConfig();
      config.issuer = 'test-issuer';
      config.audience = 'test-audience';
      config.authHeaderPrefix = 'x-Fp8-';
      config.mapper = {
        email: 'x-fp8-email', // lowercase should fail
        role: 'X-FP8-ROLE',
      };

      const errors = await validate(config);
      expect(errors).toHaveLength(0);
    });
  });
});
