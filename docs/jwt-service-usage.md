# JWT Service Usage Examples

The `JwtService` provides automatic JWT validation with public key retrieval from well-known locations (OpenID Connect Discovery).

## Basic Usage

```typescript
import { JwtService } from './services/jwt.service';
import { JwtValidator } from './dto/jwt.dto';

// Configure JWT validation rules
const jwtConfig = {
  filter: {
    'role': 'admin',
    'department': '/^(engineering|security)$/'
  },
  mapper: {
    'sub': 'x-user-id',
    'email': 'x-user-email',
    'role': 'x-user-role'
  }
};

const validator = new JwtValidator(jwtConfig);

// Create JWT service
const jwtService = new JwtService({
  issuer: 'https://your-auth-provider.com',
  audience: 'your-api-audience',
  clockTolerance: 30, // 30 seconds
  maxCacheAge: 3600000, // 1 hour
  validator: validator
});

// Validate a JWT token
try {
  const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5In0...';
  const claims = await jwtService.validateToken(token);
  
  console.log('Valid token claims:', claims);
  
  // Map claims to HTTP headers
  const headers = jwtService.mapClaims(claims);
  console.log('Mapped headers:', headers);
  
} catch (error) {
  console.error('JWT validation failed:', error.message);
}
```

## Features

### 1. Automatic Public Key Discovery
- Automatically discovers the JWKS URI from the issuer's OpenID Connect configuration
- Fetches public keys from `/.well-known/openid-configuration` and JWKS endpoints
- Caches public keys to avoid repeated network calls

### 2. JWT Validation
- Validates JWT signature using the appropriate public key
- Checks issuer, audience, and expiration claims
- Supports configurable clock tolerance for time-based claims

### 3. Additional Claim Validation
- Uses the existing `JwtValidator` for custom claim filtering
- Supports regex patterns for flexible claim matching
- Validates array claims (e.g., roles) with OR logic

### 4. Claim Mapping
- Maps JWT claims to HTTP headers or other formats
- Handles different claim types (strings, numbers, arrays, objects)
- Configurable field mapping

## Configuration Options

```typescript
interface JwtServiceOptions {
  issuer: string;           // Required: JWT issuer URL
  audience?: string;        // Optional: Expected audience
  clockTolerance?: number;  // Optional: Clock skew tolerance in seconds (default: 30)
  maxCacheAge?: number;     // Optional: Cache duration in milliseconds (default: 1 hour)
  validator?: JwtValidator; // Optional: Additional claim validation
}
```

## Error Handling

The service throws descriptive errors for various failure scenarios:

- `Invalid JWT token format` - Token is malformed
- `JWT token missing key ID (kid) in header` - Token lacks key identifier
- `Public key not found for key ID: {kid}` - Key not found in JWKS
- `Failed to discover JWKS URI` - OpenID configuration unavailable
- `Failed to fetch JWKS` - JWKS endpoint unreachable
- `JWT validation failed: {reason}` - Token validation failed

## Cache Management

The service automatically caches:
- OpenID Connect configuration (1 hour default)
- Public keys from JWKS (1 hour default)

To clear caches manually:

```typescript
jwtService.clearCache();
```

## Integration with Existing Code

The service integrates seamlessly with the existing `JwtValidator`:

```typescript
import { ConfigData } from './dto/config.dto';

// From your existing configuration
const config = new ConfigData();
const validator = config.getJwtValidator();

// Use with JWT service
const jwtService = new JwtService({
  issuer: 'https://your-issuer.com',
  validator: validator
});
```

## Security Considerations

1. **HTTPS Only**: The service only works with HTTPS issuers for security
2. **Key Rotation**: Automatically handles key rotation by fetching fresh keys
3. **Clock Tolerance**: Configurable tolerance for time-based claims
4. **Cache Expiration**: Automatic cache expiration prevents stale keys
5. **Error Logging**: Detailed error logging for security auditing

## Performance

- Public keys are cached to minimize network calls
- OpenID configuration is cached separately
- Configurable cache expiration
- Minimal memory footprint with automatic cleanup
