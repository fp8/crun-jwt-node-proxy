import * as http from 'http';
import * as https from 'https';
import { jwtDecode } from 'jwt-decode';
import { isEmpty } from 'jlog-facade';

import { createLogger } from './logger';
import { IJwtClaim } from './interfaces';

const logger = createLogger();

export function getIsoDateString(date: Date): string {
  logger.info(`Converting date to ISO string: ${date.toString()}`);
  // Ensure the date is in ISO format
  return date.toISOString();
}

/**
 * A function that will return the first `length` characters of the string from the start
 * and the last `length` characters of the string from the end, joined by an ellipsis.
 */
export function getShortenedString(input: string, length = 10): string {
  if (input.length <= length * 2) {
    return input; // No need to shorten
  }
  const start = input.slice(0, length);
  const end = input.slice(-length);
  return `${start}...${end}`;
}

/**
 * Designed to be used when an Error is caught.  JS allow you to throw anything so
 * the error caught might not be an instance of error.  Optionally allow you to send
 * a custom error message.
 *
 * @param error
 * @returns
 */
export function createError(message: string | unknown, error?: unknown): Error {
  if (typeof message === 'string') {
    // Error message provided
    if (error === undefined) {
      // This branch shouldn't really be used by the caller.  It works but make no sense
      return new Error(message);
    } else {
      // Throw error using message provided and add original error as cause
      return new Error(message, { cause: error });
    }
  } else {
    // Is message is not a string, ignore the error param
    if (message instanceof Error) {
      return message;
    } else {
      return new Error(`Unknown error ${message}`);
    }
  }
}

/**
 * Parse a JWT token and return the decoded claims.
 *
 * @param token
 * @returns
 */
export function decodeJwt(token?: string): IJwtClaim {
  if (token === undefined || isEmpty(token)) {
    throw new Error('No JWT token provided for decoding');
  }

  logger.debug(`Decoding JWT token: ${getShortenedString(token)}`);
  try {
    const decoded = jwtDecode<IJwtClaim>(token);
    logger.debug(`Decoded JWT: ${JSON.stringify(decoded)}`);
    return decoded;
  } catch (err) {
    const error = createError(err);
    logger.error(`Failed to decode JWT: ${error.message}`);
    throw error;
  }
}

// From gcutils
/**
 * Fetches text content from a URL
 */
export async function fetch(
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': '@fp8/crun-jwt-node-proxy',
        ...headers, // Merge additional headers
      },
      timeout: 5000, // 5 seconds timeout (increased for HTTPS)
    };

    const req = requestModule.request(options, (res) => {
      const data: string[] = [];

      res.on('data', (chunk) => {
        data.push(chunk.toString());
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data.join(''));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetches JSON from a URL
 */
export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  const headersWithAccept = {
    Accept: 'application/json',
    ...headers,
  };

  const text = await fetch(url, headersWithAccept);

  try {
    return JSON.parse(text);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON response: ${errorMessage}`);
  }
}
