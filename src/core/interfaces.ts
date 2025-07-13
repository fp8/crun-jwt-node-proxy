export interface IJwtClaim {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
  // Allow additional properties
  [key: string]: string | string[] | number;
}

export interface IJwtValidationOptions {
  signatureOnly?: boolean;
  publicKey?: string;
}
