# Cloud Run Proxy for JWT authentication

## 0.5.0 [2025-09-01]

* Added support for `BEAR_TOKEN_SECRET`


## 0.4.0 [2025-07-14]

* Added support for `ProxyConfig.proxyBaseUrl` and `PROXY_BASE_URL` that will be removed before proxied

## 0.3.0 [2025-07-13]

* Added support to retrive Google Cloud Project ID from metadata server

## 0.2.0 [2025-07-09]

* Added `authHeaderPrefix` to `JwtConfig` to ensure that all auth header
  are cleared before being added by the proxy
* Added SIGINT handler to gracefully shutdown the server
* Changed to use docker builder from Cloud Build

## 0.1.0 [2025-06-09]

* Initial Commit
