import 'reflect-metadata';
import { validate } from 'class-validator';
import { JwtConfig, ConfigData, ProxyConfig } from '../../src/dto/config.dto';

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

describe('ConfigData', () => {
  describe('getProxyBaseUrl', () => {
    let configData: ConfigData;
    let proxyConfig: ProxyConfig;
    let jwtConfig: JwtConfig;

    beforeEach(() => {
      // Setup basic configuration
      proxyConfig = new ProxyConfig();
      proxyConfig.url = 'http://localhost:8080';

      jwtConfig = new JwtConfig();
      jwtConfig.issuer = 'test-issuer';
      jwtConfig.authHeaderPrefix = 'X-AUTH-';
      jwtConfig.mapper = {};

      configData = new ConfigData();
      configData.name = 'test-config';
      configData.port = 8888;
      configData.proxy = proxyConfig;
      configData.jwt = jwtConfig;
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.PROXY_BASE_URL;
    });

    it('should return proxyBaseUrl from config when no environment variable is set', () => {
      proxyConfig.proxyBaseUrl = '/api/candidates';

      const result = configData.getProxyBaseUrl();

      expect(result).toBe('/api/candidates');
    });

    it('should return environment variable when PROXY_BASE_URL is set', () => {
      proxyConfig.proxyBaseUrl = '/api/candidates';
      process.env.PROXY_BASE_URL = '/env/api';

      const result = configData.getProxyBaseUrl();

      expect(result).toBe('/env/api');
    });

    it('should return undefined when proxyBaseUrl is not configured and no environment variable', () => {
      // proxyBaseUrl is undefined by default

      const result = configData.getProxyBaseUrl();

      expect(result).toBeUndefined();
    });

    it('should return environment variable even when config proxyBaseUrl is undefined', () => {
      // proxyBaseUrl is undefined by default
      process.env.PROXY_BASE_URL = '/env/only';

      const result = configData.getProxyBaseUrl();

      expect(result).toBe('/env/only');
    });

    it('should handle empty string environment variable', () => {
      proxyConfig.proxyBaseUrl = '/api/candidates';
      process.env.PROXY_BASE_URL = '';

      const result = configData.getProxyBaseUrl();

      expect(result).toBe('/api/candidates');
    });

    it('should handle empty string config value', () => {
      proxyConfig.proxyBaseUrl = '';

      const result = configData.getProxyBaseUrl();

      expect(result).toBe('');
    });
  });
});
