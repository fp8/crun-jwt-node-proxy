import 'reflect-metadata';
import * as http from 'http';
import * as httpProxy from 'http-proxy';
import { ConfigData, ProxyConfig, JwtConfig } from '../../src/dto/config.dto';

// Mock the logger to avoid actual logging during tests
jest.mock('../../src/core/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock JWT service
const mockJwtService = {
  validateToken: jest.fn(),
  mapClaims: jest.fn(),
};

jest.mock('../../src/services/jwt.service', () => ({
  JwtService: jest.fn().mockImplementation(() => mockJwtService),
}));

// Mock http-proxy
const mockProxy = {
  web: jest.fn(),
};

jest.mock('http-proxy', () => ({
  createProxyServer: jest.fn(() => mockProxy),
}));

describe('Proxy Base URL Rewriting', () => {
  let mockRequest: Partial<http.IncomingMessage>;
  let mockResponse: Partial<http.ServerResponse>;
  let config: ConfigData;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request
    mockRequest = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      url: '/api/candidates/italy/123',
      method: 'GET',
    };

    // Setup mock response
    mockResponse = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    // Create test configuration
    const proxyConfig = new ProxyConfig();
    proxyConfig.url = 'http://localhost:8080';
    proxyConfig.proxyBaseUrl = '/api/candidates';

    const jwtConfig = new JwtConfig();
    jwtConfig.issuer = 'test-issuer';
    jwtConfig.authHeaderPrefix = 'X-AUTH-';
    jwtConfig.mapper = {};

    config = new ConfigData();
    config.name = 'test-proxy';
    config.port = 8888;
    config.proxy = proxyConfig;
    config.jwt = jwtConfig;

    // Mock JWT validation to return valid claims
    mockJwtService.validateToken.mockResolvedValue({
      sub: 'user123',
      email: 'user@example.com',
      iss: 'test-issuer',
      aud: 'test-audience',
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
    });

    mockJwtService.mapClaims.mockReturnValue({});
  });

  describe('URL rewriting with proxyBaseUrl', () => {
    it('should rewrite URL by removing proxy base URL prefix', async () => {
      // Import and create the proxy server after mocks are set up
      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Mock config.getProxyBaseUrl() to return the base URL
      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      // Simulate incoming request by directly calling the request handler
      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Verify the URL was rewritten correctly
      expect(mockRequest.url).toBe('/italy/123');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should handle URL rewriting when base URL has trailing slash', async () => {
      mockRequest.url = '/api/candidates/italy/123';

      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Mock config with trailing slash
      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates/');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Verify the URL was rewritten correctly (trailing slash should be removed from base URL)
      expect(mockRequest.url).toBe('/italy/123');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should rewrite to root path when URL exactly matches base URL', async () => {
      mockRequest.url = '/api/candidates';

      const { createProxyServer } = await import('../../src/services/proxy.service');

      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Should rewrite to root path
      expect(mockRequest.url).toBe('/');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should handle query parameters correctly during rewriting', async () => {
      mockRequest.url = '/api/candidates/search?name=john&age=30';

      const { createProxyServer } = await import('../../src/services/proxy.service');

      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Query parameters should be preserved
      expect(mockRequest.url).toBe('/search?name=john&age=30');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should throw error when URL does not match proxy base URL', async () => {
      mockRequest.url = '/different/path/123';

      const { createProxyServer } = await import('../../src/services/proxy.service');

      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Should return 400 error response
      expect(mockResponse.writeHead).toHaveBeenCalledWith(400, {
        'Content-Type': 'application/json',
      });
      expect(mockResponse.end).toHaveBeenCalledWith(
        JSON.stringify({
          error: 'Bad Request',
          message:
            'Request URL /different/path/123 does not match proxy base URL /api/candidates',
        }),
      );
      // Proxy should not be called
      expect(mockProxy.web).not.toHaveBeenCalled();
    });

    it('should not perform URL rewriting when proxyBaseUrl is not configured', async () => {
      const originalUrl = '/api/candidates/italy/123';
      mockRequest.url = originalUrl;

      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Mock config without proxy base URL
      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue(undefined);
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // URL should remain unchanged
      expect(mockRequest.url).toBe(originalUrl);
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should handle empty string proxyBaseUrl', async () => {
      const originalUrl = '/api/candidates/italy/123';
      mockRequest.url = originalUrl;

      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Mock config with empty string base URL
      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // URL should remain unchanged
      expect(mockRequest.url).toBe(originalUrl);
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('URL rewriting with environment variable override', () => {
    it('should use PROXY_BASE_URL environment variable when set', async () => {
      // Set environment variable
      process.env.PROXY_BASE_URL = '/env/api';
      mockRequest.url = '/env/api/users/123';

      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Even though config has different base URL, env should take precedence
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Should rewrite using environment variable
      expect(mockRequest.url).toBe('/users/123');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);

      // Clean up
      delete process.env.PROXY_BASE_URL;
    });
  });

  describe('Integration with existing JWT processing', () => {
    it('should perform URL rewriting after JWT validation and header processing', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
        'x-auth-existing': 'old-value',
      };

      const { createProxyServer } = await import('../../src/services/proxy.service');

      // Mock JWT service to return mapped headers
      mockJwtService.mapClaims.mockReturnValue({
        'X-AUTH-USER-ID': 'user123',
        'X-AUTH-EMAIL': 'user@example.com',
      });

      jest.spyOn(config, 'getProxyBaseUrl').mockReturnValue('/api/candidates');
      jest.spyOn(config, 'getProxyTarget').mockReturnValue({
        host: 'localhost',
        port: 8080,
        protocol: 'http:',
      });

      const server = createProxyServer(config);

      const requestListener = (server as any).listeners('request')[0];
      await requestListener(mockRequest, mockResponse);

      // Verify JWT processing happened
      expect(mockJwtService.validateToken).toHaveBeenCalled();
      expect(mockJwtService.mapClaims).toHaveBeenCalled();

      // Verify headers were processed (existing auth headers removed, new ones added)
      expect(mockRequest.headers).not.toHaveProperty('x-auth-existing');
      expect(mockRequest.headers).toHaveProperty('X-AUTH-USER-ID', 'user123');
      expect(mockRequest.headers).toHaveProperty(
        'X-AUTH-EMAIL',
        'user@example.com',
      );

      // Verify URL was rewritten
      expect(mockRequest.url).toBe('/italy/123');
      expect(mockProxy.web).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });
});
