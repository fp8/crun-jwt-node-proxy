import type { JwtValidator } from './validator';

// JWT-related interfaces

export interface JwksKey {
  kty: string;
  kid: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  x5t?: string;
  alg?: string;
}

export interface JwksResponse {
  keys: JwksKey[];
}

export interface OpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
}

export interface JwtServiceOptions {
  issuer: string;
  audience?: string;
  clockTolerance?: number;
  maxCacheAge?: number;
  validator?: JwtValidator;
}
