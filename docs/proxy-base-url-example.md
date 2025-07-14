# Proxy Base URL Example

This document demonstrates how the proxy base URL rewriting feature works with a practical example.

## Configuration Example

```yaml
# etc/local/config.yaml
name: crun-jwt-node-proxy-local
port: 8888
proxy:
  url: https://request-echo-839315814860.europe-west1.run.app
  proxyBaseUrl: /api/candidates
  certPath: ./certs/client-identity.p12
jwt:
  issuer: https://securetoken.google.com/{{ENV.GOOGLE_CLOUD_PROJECT}}
  audience: "{{ENV.GOOGLE_CLOUD_PROJECT}}"
  authHeaderPrefix: "X-AUTH-"
  filter:
    email: /farport.co$/
  mapper:
    sub: X-AUTH-USERID
    email: X-AUTH-EMAIL
```

## How It Works

With the above configuration, the proxy will:

1. **Listen** on port 8888
2. **Validate** incoming JWTs from Firebase Auth
3. **Strip** the `/api/candidates` prefix from incoming URLs
4. **Forward** requests to the target service

## Request Flow Examples

### Example 1: Basic API Request
```
Incoming: GET http://localhost:8888/api/candidates/italy/12345
↓ JWT validation and header processing
↓ URL rewriting: Strip "/api/candidates"
Outgoing: GET https://request-echo-839315814860.europe-west1.run.app/italy/12345
```

### Example 2: Query Parameters
```
Incoming: GET http://localhost:8888/api/candidates/search?country=italy&limit=10
↓ JWT validation and header processing  
↓ URL rewriting: Strip "/api/candidates"
Outgoing: GET https://request-echo-839315814860.europe-west1.run.app/search?country=italy&limit=10
```

### Example 3: Root Path Match
```
Incoming: GET http://localhost:8888/api/candidates
↓ JWT validation and header processing
↓ URL rewriting: Strip "/api/candidates" → "/"
Outgoing: GET https://request-echo-839315814860.europe-west1.run.app/
```

### Example 4: Non-matching URL (unchanged)
```
Incoming: GET http://localhost:8888/health
↓ JWT validation and header processing
↓ URL rewriting: No match, pass through unchanged  
Outgoing: GET https://request-echo-839315814860.europe-west1.run.app/health
```

## Environment Variable Override

You can override the proxy base URL using an environment variable:

```bash
export PROXY_BASE_URL=/v2/api
# Now all requests to /v2/api/* will be rewritten
```

## Testing the Feature

To test this feature locally:

1. **Start the proxy**:
   ```bash
   make start
   ```

2. **Send a test request**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:8888/api/candidates/italy/12345
   ```

3. **Verify the URL rewriting** by checking the logs or the target service logs.

## Security Considerations

- JWT validation happens **before** URL rewriting
- Headers are processed **before** URL rewriting  
- Non-matching URLs are still processed through JWT validation
- The `proxyBaseUrl` acts as a routing filter, not a security boundary
