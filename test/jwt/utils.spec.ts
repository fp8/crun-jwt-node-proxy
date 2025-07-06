import '../testlib';

import * as https from 'https';
import * as http from 'http';
import { 
  discoverJwksUri, 
  fetchJwks, 
  rsaJwkToPem 
} from '../../src/jwt/utils';
import { JwksKey, JwksResponse, OpenIdConfiguration } from 'jwt/interfaces';

// Mock the https and http modules
jest.mock('https');
jest.mock('http');

describe('JWT Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverJwksUri', () => {
    it('should discover JWKS URI from OpenID configuration', async () => {
      const mockConfig: OpenIdConfiguration = {
        issuer: 'https://example.com',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        authorization_endpoint: 'https://example.com/auth',
        token_endpoint: 'https://example.com/token',
      };

      // Mock successful response
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockConfig));
          } else if (event === 'end') {
            callback();
          }
        }),
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await discoverJwksUri('https://example.com');
      expect(result).toBe('https://example.com/.well-known/jwks.json');
    });

    it('should throw error when JWKS URI is not found in configuration', async () => {
      const mockConfig = {
        issuer: 'https://example.com',
        // missing jwks_uri
      };

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockConfig));
          } else if (event === 'end') {
            callback();
          }
        }),
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(discoverJwksUri('https://example.com')).rejects.toThrow(
        'Failed to discover JWKS URI: JWKS URI not found in OpenID configuration'
      );
    });

    it('should throw error when HTTP request fails', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
        }),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation(() => {
        return mockRequest;
      });

      await expect(discoverJwksUri('https://example.com')).rejects.toThrow(
        'Failed to discover JWKS URI: Request failed: Network error'
      );
    });
  });

  describe('fetchJwks', () => {
    it('should fetch JWKS successfully', async () => {
      const mockJwks: JwksResponse = {
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

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockJwks));
          } else if (event === 'end') {
            callback();
          }
        }),
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchJwks('https://example.com/.well-known/jwks.json');
      expect(result).toEqual(mockJwks);
    });

    it('should throw error when fetching JWKS fails', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
        }),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation(() => {
        return mockRequest;
      });

      await expect(fetchJwks('https://example.com/.well-known/jwks.json')).rejects.toThrow(
        'Failed to fetch JWKS: Request failed: Network error'
      );
    });
  });

  describe('rsaJwkToPem', () => {
    it('should convert RSA JWK to PEM format', () => {
      const mockJwk: JwksKey = {
        kty: 'RSA',
        kid: 'test-key-id',
        use: 'sig',
        n: 'wf-wiusGhA-gleZYQAON9lXjwi1S6xpYNvGAFJvGHMqBIhj0JZlcjMDJLPYUg8pAXIhO8oIUGf1WmLfXGfSgIoJZJSU6VGHKgPzACXd8qhHGnmMbVBZPQZUMsKJ9JQEJSq',
        e: 'AQAB',
        alg: 'RS256',
      };

      const result = rsaJwkToPem(mockJwk);
      
      expect(result).toContain('-----BEGIN PUBLIC KEY-----');
      expect(result).toContain('-----END PUBLIC KEY-----');
      expect(typeof result).toBe('string');
    });

    it('should throw error for unsupported key type', () => {
      const mockJwk: JwksKey = {
        kty: 'EC', // Not RSA
        kid: 'test-key-id',
        use: 'sig',
        alg: 'ES256',
      };

      expect(() => rsaJwkToPem(mockJwk)).toThrow('Unsupported key type: EC');
    });

    it('should throw error for invalid RSA key (missing n)', () => {
      const mockJwk: JwksKey = {
        kty: 'RSA',
        kid: 'test-key-id',
        use: 'sig',
        e: 'AQAB',
        // n is missing
        alg: 'RS256',
      };

      expect(() => rsaJwkToPem(mockJwk)).toThrow('Invalid RSA key: missing n or e parameters');
    });

    it('should throw error for invalid RSA key (missing e)', () => {
      const mockJwk: JwksKey = {
        kty: 'RSA',
        kid: 'test-key-id',
        use: 'sig',
        n: 'wf-wiusGhA-gleZYQAON9lXjwi1S6xpYNvGAFJvGHMqBIhj0JZlcjMDJLPYUg8pAXIhO8oIUGf1WmLfXGfSgIoJZJSU6VGHKgPzACXd8qhHGnmMbVBZPQZUMsKJ9JQEJSq',
        // e is missing
        alg: 'RS256',
      };

      expect(() => rsaJwkToPem(mockJwk)).toThrow('Invalid RSA key: missing n or e parameters');
    });

    it('should handle various RSA key sizes', () => {
      const mockJwk: JwksKey = {
        kty: 'RSA',
        kid: 'test-key-id-2',
        use: 'sig',
        n: 'xGUKCjWrUdWUF9k0TjWm4C7cQCKAo9JXgcmKKd4BmfHPqhQHVJpQCDHLjd7qxRkMDe3YGKQnxjhTiKqxqQBEJh2fQAOsWIqNQIDAQAB',
        e: 'AQAB',
        alg: 'RS256',
      };

      const result = rsaJwkToPem(mockJwk);
      
      expect(result).toContain('-----BEGIN PUBLIC KEY-----');
      expect(result).toContain('-----END PUBLIC KEY-----');
      expect(typeof result).toBe('string');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON in discovery', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('invalid json');
          } else if (event === 'end') {
            callback();
          }
        }),
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(discoverJwksUri('https://example.com')).rejects.toThrow(
        'Failed to discover JWKS URI: Failed to parse JSON response:'
      );
    });

    it('should handle HTTP error status codes', async () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found',
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('Not Found');
          } else if (event === 'end') {
            callback();
          }
        }),
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(discoverJwksUri('https://example.com')).rejects.toThrow(
        'Failed to discover JWKS URI: HTTP 404: Not Found'
      );
    });

    it('should handle request timeout', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'timeout') {
            callback();
          }
        }),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation(() => {
        return mockRequest;
      });

      await expect(discoverJwksUri('https://example.com')).rejects.toThrow(
        'Failed to discover JWKS URI: Request timeout'
      );
    });
  });
});
