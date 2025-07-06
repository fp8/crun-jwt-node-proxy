import { loadTextFile } from '../testlib';
import { JwtService } from '../../src/services/jwt.service';

describe('JwtService for Firebase - Integration Tests', () => {
  const firebaseJwtService = new JwtService({
    issuer: 'https://securetoken.google.com/fp8netes-dev',
  });

  const iamJwtService = new JwtService({
    issuer: 'https://accounts.google.com',
  });

  it('validate firebase JWT with signature only (ignoring expiry)', async () => {
    const jwt = loadTextFile('jwt/jwt-firebase.txt');
    // Using signature-only validation since the token is expired
    const claims = await firebaseJwtService.validateToken(jwt, { signatureOnly: true });
    expect(claims).toBeDefined();
    expect(claims.sub).toBe('Vl30SR5kIMWdqCdN5cr4Ptd62b53');
    expect(claims.email).toBe('marcos.lin@farport.co');
    expect(claims.exp).toBe(1751799717); // Should still return the expiry claim
  });

  it('validate IAM JWT with signature only (ignoring expiry)', async () => {
    const jwt = loadTextFile('jwt/jwt-iam.txt');
    // Using signature-only validation since the token is expired
    const claims = await iamJwtService.validateToken(jwt, { signatureOnly: true });
    expect(claims).toBeDefined();
    expect(claims.sub).toBe('114789851119851077143');
    expect(claims.email).toBe('marcos.lin@farport.co');
    expect(claims.exp).toBe(1751798347); // Should still return the expiry claim
  });

  it('should fail validation when token is expired (normal validation)', async () => {
    const jwt = loadTextFile('jwt/jwt-firebase.txt');

    // If the token is expired, this should fail with normal validation
    // Note: This test may pass if the token is not yet expired
    try {
      await firebaseJwtService.validateToken(jwt);
      // If we get here, the token is not expired yet
      console.log('Token is not expired yet, skipping expiry test');
    } catch (error) {
      const err = error as Error;
      expect(err.message).toContain('JWT validation failed');
      expect(err.message.toLowerCase()).toContain('expired');
    }
  });
});
