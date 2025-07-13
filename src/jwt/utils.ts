import { JwksKey, JwksResponse, OpenIdConfiguration } from './interfaces';

import { fetchJson } from '../core/helpers';
import { createLogger } from '../core/logger';

const logger = createLogger('jwt.utils');

/**
 * Discovers the JWKS URI from the OpenID Connect configuration
 */
export async function discoverJwksUri(issuer: string): Promise<string> {
  const wellKnownUrl = `${issuer}/.well-known/openid-configuration`;

  try {
    const config = await fetchJson<OpenIdConfiguration>(wellKnownUrl);

    if (!config.jwks_uri) {
      throw new Error('JWKS URI not found in OpenID configuration');
    }

    logger.debug('Discovered JWKS URI', {
      issuer,
      jwksUri: config.jwks_uri,
    });

    return config.jwks_uri;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to discover JWKS URI', {
      issuer,
      error: errorMessage,
    });
    throw new Error(`Failed to discover JWKS URI: ${errorMessage}`);
  }
}

/**
 * Fetches the JWKS from the JWKS URI
 */
export async function fetchJwks(jwksUri: string): Promise<JwksResponse> {
  try {
    const jwks = await fetchJson<JwksResponse>(jwksUri);
    logger.debug('Fetched JWKS successfully', {
      keyCount: jwks.keys.length,
      jwksUri,
    });
    return jwks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch JWKS', {
      jwksUri,
      error: errorMessage,
    });
    throw new Error(`Failed to fetch JWKS: ${errorMessage}`);
  }
}

/**
 * Converts a RSA based JWK to PEM format
 */
export function rsaJwkToPem(jwk: JwksKey): string {
  if (jwk.kty !== 'RSA') {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  if (!jwk.n || !jwk.e) {
    throw new Error('Invalid RSA key: missing n or e parameters');
  }

  // Convert base64url to buffer
  const nBuffer = Buffer.from(jwk.n, 'base64url');
  const eBuffer = Buffer.from(jwk.e, 'base64url');

  // Create ASN.1 DER encoded public key
  const publicKeyDer = createRsaPublicKeyDer(nBuffer, eBuffer);

  // Convert to PEM format
  const publicKeyPem = derToPem(publicKeyDer, 'PUBLIC KEY');

  return publicKeyPem;
}

/**
 * Creates RSA public key in DER format
 */
function createRsaPublicKeyDer(n: Buffer, e: Buffer): Buffer {
  // RSA public key ASN.1 structure
  const modulusLength = encodeLength(n.length);
  const exponentLength = encodeLength(e.length);

  const modulus = Buffer.concat([Buffer.from([0x02]), modulusLength, n]);
  const exponent = Buffer.concat([Buffer.from([0x02]), exponentLength, e]);

  const rsaPublicKey = Buffer.concat([modulus, exponent]);
  const rsaPublicKeyLength = encodeLength(rsaPublicKey.length);

  const sequence = Buffer.concat([
    Buffer.from([0x30]),
    rsaPublicKeyLength,
    rsaPublicKey,
  ]);

  // RSA encryption OID
  const rsaOid = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  const publicKeyInfo = Buffer.concat([
    rsaOid,
    Buffer.from([0x03]),
    encodeLength(sequence.length + 1),
    Buffer.from([0x00]),
    sequence,
  ]);

  const publicKeyInfoLength = encodeLength(publicKeyInfo.length);

  return Buffer.concat([
    Buffer.from([0x30]),
    publicKeyInfoLength,
    publicKeyInfo,
  ]);
}

/**
 * Encodes length in ASN.1 DER format
 */
function encodeLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  } else if (length < 0x100) {
    return Buffer.from([0x81, length]);
  } else if (length < 0x10000) {
    return Buffer.from([0x82, length >> 8, length & 0xff]);
  } else if (length < 0x1000000) {
    return Buffer.from([
      0x83,
      length >> 16,
      (length >> 8) & 0xff,
      length & 0xff,
    ]);
  } else {
    return Buffer.from([
      0x84,
      length >> 24,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ]);
  }
}

/**
 * Converts DER to PEM format
 */
function derToPem(der: Buffer, type: string): string {
  const base64 = der.toString('base64');
  const pem = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN ${type}-----\n${pem}\n-----END ${type}-----\n`;
}
