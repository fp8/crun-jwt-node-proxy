# crun-jwt-node-proxy

This project creates a docker image that is to be deployed as a sidecar in a Google
Cloud Run service to validate Firebase Auth JWT.  The validation is project id specific
so as long as `GOOGLE_CLOUD_PROJECT` is provided the Firebase Auth JWT should be
validated correctly.

## ENV needed for proxy service

Following ends are required for cloud run to work:

* `GOOGLE_CLOUD_PROJECT`: GCloud projectId to use and must set in local dev.  If not set, attempt
  to obtain this info from the metadata server.
* `PROXY_TARGET`: The url of target project. Defaults to `http://localhost:8080`
* `PROXY_BASE_URL`: Set the url that proxy will listen to but removed before forwarding to `PROXY_TARGET`
* `PORT`: The port that proxy should be listening.  Defaults to `8888`
* `NODE_ENV`: When this is set to `PRODUCTION`, `GCloudDestination` will be used

## Configuration

The service is configured via YAML configuration files. The main configuration sections are:

### JWT Configuration

The `jwt` section configures JWT token validation and processing:

```yaml
jwt:
  issuer: https://securetoken.google.com/{{ENV.GOOGLE_CLOUD_PROJECT}}
  audience: "{{ENV.GOOGLE_CLOUD_PROJECT}}"
  clockTolerance: 30
  maxCacheAge: 86400000
  filter:
    email: /test\.com$/
    role: admin
  mapper:
    sub: X-AUTH-USERID
    email: X-AUTH-EMAIL
    custom_claims: X-AUTH-CLAIMS
```

#### JWT Properties

- **issuer**: The expected JWT issuer. Supports environment variable substitution using `{{ENV.VARIABLE_NAME}}` syntax.
- **audience**: The expected JWT audience. Typically your Google Cloud Project ID.
- **clockTolerance** (optional): Time tolerance in seconds for JWT expiration validation. Default: 30 seconds.
- **maxCacheAge** (optional): Maximum age in milliseconds to cache public keys. Default: 86400000 (24 hours).

#### JWT Filter

The `filter` section validates JWT claims before allowing the request to proceed. This acts as an access control mechanism:

- **Exact Match**: Validates that a claim has an exact value
  ```yaml
  filter:
    role: admin          # Requires role claim to be exactly "admin"
    department: "IT"     # Requires department claim to be exactly "IT"
  ```

- **Regex Match**: Validates that a claim matches a regular expression pattern (enclosed in forward slashes)
  ```yaml
  filter:
    email: /farport\.co$/     # Requires email to end with "farport.co"
    username: /^admin_/       # Requires username to start with "admin_"
  ```

- **Array Support**: For array claims, validation passes if ANY element matches (OR logic)
  ```yaml
  filter:
    roles: admin             # Passes if "admin" is found in roles array
    permissions: /^read_/    # Passes if any permission starts with "read_"
  ```

**Filter Behavior**:
- If any filter fails, the request is rejected with an authentication error
- Missing claims that are referenced in filters will cause validation failure
- Filters are applied before mapping occurs

#### JWT Mapper

The `mapper` section extracts JWT claims and converts them into HTTP headers that are forwarded to the target service:

```yaml
mapper:
  sub: X-AUTH-USERID           # Maps 'sub' claim to X-AUTH-USERID header
  email: X-AUTH-EMAIL          # Maps 'email' claim to X-AUTH-EMAIL header
  custom_data: X-AUTH-DATA     # Maps 'custom_data' claim to X-AUTH-DATA header
```

**Mapping Behavior**:
- **String/Number claims**: Converted to string and set as header value
- **Array claims**: Joined with commas (e.g., `["admin", "user"]` becomes `"admin,user"`)
- **Object claims**: Serialized to JSON string
- **Missing claims**: Headers are not set (no error occurs)

#### Example Configurations

**Basic Configuration** (no filtering, basic mapping):
```yaml
jwt:
  issuer: https://securetoken.google.com/my-project
  audience: my-project
  mapper:
    sub: X-AUTH-USERID
    email: X-AUTH-EMAIL
```

**Strict Access Control** (email domain restriction):
```yaml
jwt:
  issuer: https://securetoken.google.com/my-project
  audience: my-project
  filter:
    email: /company\.com$/    # Only allow company.com emails
    verified: true            # Only allow verified accounts
  mapper:
    sub: X-AUTH-USERID
    email: X-AUTH-EMAIL
    name: X-AUTH-NAME
```

**Role-Based Access** (multiple role support):
```yaml
jwt:
  issuer: https://securetoken.google.com/my-project
  audience: my-project
  filter:
    roles: admin             # User must have "admin" in their roles array
  mapper:
    sub: X-AUTH-USERID
    email: X-AUTH-EMAIL
    roles: X-AUTH-ROLES      # Forward all roles as comma-separated list
```

### Proxy Configuration

The `proxy` section configures the target service and URL rewriting behavior:

```yaml
proxy:
  url: http://localhost:8080        # Target service URL
  proxyBaseUrl: /api/candidates     # Optional: Base URL to strip from incoming requests
  certPath: ./certs/client.p12      # Optional: Client certificate for HTTPS
  passphrase: secret123             # Optional: Certificate passphrase
```

#### Proxy Properties

- **url**: The target service URL where requests will be forwarded
- **proxyBaseUrl** (optional): Base URL path that will be stripped from incoming requests before forwarding
- **certPath** (optional): Path to client certificate file for mutual TLS authentication
- **passphrase** (optional): Passphrase for the client certificate

#### URL Rewriting with proxyBaseUrl

The `proxyBaseUrl` feature allows you to expose your service under a different path prefix. When configured, the proxy will:

1. **Validate** that incoming requests start with the specified base URL
2. **Strip** the base URL prefix from the request before forwarding
3. **Forward** the modified request to the target service

**Example:**
```yaml
proxy:
  url: http://localhost:8080
  proxyBaseUrl: /api/candidates
```

With this configuration:
- Incoming: `GET http://proxy:8888/api/candidates/italy/123`
- Forwarded: `GET http://localhost:8080/italy/123`

**Environment Variable Override:**
You can override the `proxyBaseUrl` using the `PROXY_BASE_URL` environment variable:
```bash
export PROXY_BASE_URL=/different/api/path
```

**Edge Cases:**
- If the incoming URL doesn't match the `proxyBaseUrl`, a bad request error will be thrown
- Query parameters and fragments are preserved during rewriting
- Exact matches (e.g., `/api/candidates`) are rewritten to the root path (`/`)

# Local Dev

There are 2 envs setup for local development:

* `local`: This env is setup to point to `request-echo` Cloud Run service in `fp8netes-dev`.  You must generate a client certificate to use this by running `make setup`
* `local-http`: This env is setup to point to `http://localhost:8080`.  You can lauch the local version of `request-echo` by running `make start-request-echo`

## Build

There is one problem when running `make gcloud-builds`.  The `yarn.lock` is modified in
linux and causing the build to fail.  To fix this, we need to run `yarn` in the linux
which will update `yarn.lock` that is suitable for the Cloud Build.  To do that:

```bash
docker run --rm --platform linux/amd64 \
    -v $PWD/:/app \
    -w /app \
    --entrypoint /usr/local/bin/yarn \
    -it farport/node-builder:22.16.0-alpine

# Exit the container and run
make gcloud-builds
```

Do not commit the changes to the `yarn.lock` file.

## Run Container Locally

```
docker run --rm -e GOOGLE_CLOUD_PROJECT=fp8netes-dev -it europe-west1-docker.pkg.dev/fp8netes-dev/docker/crun-jwt-node-proxy:0.1.0
```