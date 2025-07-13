import {
  getIsoDateString,
  getShortenedString,
  createError,
  decodeJwt,
} from '../../src/core/helpers';

describe('helpers', () => {
  describe('getIsoDateString', () => {
    it('should convert date to ISO string', () => {
      const date = new Date('2023-10-01');
      const isoString = getIsoDateString(date);
      expect(isoString).toBe('2023-10-01T00:00:00.000Z');
    });
  });

  describe('getShortenedString', () => {
    it('should return original string if length is less than or equal to 2*length', () => {
      const input = 'short';
      const result = getShortenedString(input, 10);
      expect(result).toBe('short');
    });

    it('should return original string if length equals 2*length', () => {
      const input = 'exactlength20chars';
      const result = getShortenedString(input, 10);
      expect(result).toBe('exactlength20chars');
    });

    it('should shorten string with default length of 10', () => {
      const input = 'this is a very long string that should be shortened';
      const result = getShortenedString(input);
      expect(result).toBe('this is a ... shortened');
    });

    it('should shorten string with custom length', () => {
      const input = 'this is a very long string that should be shortened';
      const result = getShortenedString(input, 5);
      expect(result).toBe('this ...tened');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = getShortenedString(input);
      expect(result).toBe('');
    });
  });

  describe('createError', () => {
    it('should create error with string message only', () => {
      const message = 'Test error message';
      const error = createError(message);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(message);
    });

    it('should create error with string message and cause', () => {
      const message = 'Test error message';
      const cause = new Error('Original error');
      const error = createError(message, cause);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(message);
      expect(error.cause).toBe(cause);
    });

    it('should return the same error if message is already an Error instance', () => {
      const originalError = new Error('Original error');
      const error = createError(originalError);
      expect(error).toBe(originalError);
    });

    it('should create error with unknown message type', () => {
      const unknownMessage = { some: 'object' };
      const error = createError(unknownMessage);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Unknown error [object Object]');
    });

    it('should create error with null message', () => {
      const error = createError(null);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Unknown error null');
    });
  });

  describe('decodeJwt', () => {
    // Mock JWT token (this is a sample JWT with payload: {"sub":"1234567890","name":"John Doe","iat":1516239022})
    const validJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    it('should decode valid JWT token', () => {
      const decoded = decodeJwt(validJwt);
      expect(decoded).toEqual({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022,
      });
    });

    it('should throw error for undefined token', () => {
      expect(() => decodeJwt(undefined)).toThrow(
        'No JWT token provided for decoding',
      );
    });

    it('should throw error for empty string token', () => {
      expect(() => decodeJwt('')).toThrow('No JWT token provided for decoding');
    });

    it('should throw error for invalid JWT token', () => {
      expect(() => decodeJwt('invalid.jwt.token')).toThrow();
    });

    it('should throw error for malformed JWT token', () => {
      expect(() => decodeJwt('not-a-jwt-at-all')).toThrow();
    });
  });
});
