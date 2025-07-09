# Typescript Starter Project Release Note

## 0.2.0 [2025-07-09]

* Added `authHeaderPrefix` to `JwtConfig` to ensure that all auth header
  are cleared before being added by the proxy
* Added SIGINT handler to gracefully shutdown the server
* Changed to use docker builder from Cloud Build

## 0.1.0 [2025-06-09]

* Initial Commit
