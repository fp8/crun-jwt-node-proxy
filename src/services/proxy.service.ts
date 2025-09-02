import * as http from 'http';
import * as httpProxy from 'http-proxy';

import {
  BadRequestError,
  createError,
  createLogger,
  HttpError,
  IJwtClaim,
  InternalServerError,
  UnauthorizedError,
} from '../core';
import { ConfigData } from '../dto/config.dto';
import { JwtService } from '../services/jwt.service';

const DEFAULT_SUB_FOR_SECRET_AUTH = 'crun-jwt-auth-secret';
const logger = createLogger('proxy.service');

/**
 * Create a proxy server that validates request using JWT
 *
 * @param config
 * @returns
 */
export function createProxyServer(config: ConfigData): http.Server {
  const jwtService = new JwtService(config.jwt);

  // Create a proxy server with custom application logic
  // https://request-echo-839315814860.europe-west1.run.app
  const options: httpProxy.ServerOptions = {
    target: config.getProxyTarget(),
    changeOrigin: true,
  };
  const proxy = httpProxy.createProxyServer(options);

  // Create the HTTP server that proxy the request and handle any errors
  const server = http.createServer(async (req, res) => {
    try {
      await requestProcessor(req, config, jwtService);
      proxy.web(req, res);
    } catch (err) {
      errorHandler(err, res);
    }
  });

  return server;
}

/**
 * Server request processor
 *
 * @param req
 * @param res
 * @param config
 * @param jwtService
 */
async function requestProcessor(
  req: http.IncomingMessage,
  config: ConfigData,
  jwtService: JwtService,
) {
  let claims: IJwtClaim;

  try {
    const token = req.headers['authorization']?.split(' ')[1];
    // ToDo: Add secrets check here

    claims = await jwtService.validateToken(token);
  } catch (err) {
    // Throw an unauthorized error
    const error = createError('Failed to decode JWT:', {
      cause: err,
      type: UnauthorizedError,
    });
    throw error;
  }

  // Remove all incoming headers with the configured prefix
  removeAllIncomingAuthHeaders(config, req);

  // Map the JWT claims to headers
  const headers = jwtService.mapClaims(claims);
  logger.info(`Mapping JWT claims to headers: ${JSON.stringify(headers)}`);

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      req.headers[key] = value;
    } else {
      logger.warn(`Skipping undefined header for key: ${key}`);
    }
  }

  // Handle proxy base URL rewriting
  rewriteBaseUrlByStrippingBaseUrl(req, config.getProxyBaseUrl());
}

/**
 * Validate the auth header against the secret
 *
 * @param token 
 * @param config 
 * @returns 
 */
export function secretValidation(token: string, config: ConfigData): IJwtClaim | undefined {
  const secretToken = config.proxy.secretToken;
  if (token && secretToken && token === secretToken) {
    // Seconds from Epoch
    const now = Math.floor(Date.now() / 1000);

    // Return a JWT Claim for the secret
    return {
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      sub: DEFAULT_SUB_FOR_SECRET_AUTH,
      email: `${DEFAULT_SUB_FOR_SECRET_AUTH}@farport.co`,
      iat: now,
      exp: now + 3600, // Expires in 1 hour
    };
  } else {
    return undefined;
  }
}

export async function validateAuthentication(
  req: http.IncomingMessage,
  config: ConfigData,
  jwtService: JwtService
): Promise<IJwtClaim> {
  const token = req.headers['authorization']?.split(' ')[1];

  // Make sure that token exists and is not empty
  if (token === undefined || token.length === 0) {
    throw new UnauthorizedError('Missing authorization token');
  }

  // Validate the token against the secret if configured
  let claims = secretValidation(token, config);
  if (claims) {
    logger.info('Request authenticated using secret token');
    return claims;
  }

  // Perform JWT validation
  try {
    const claims = await jwtService.validateToken(token);
    return claims;
  } catch (err) {
    // Throw an unauthorized error
    const error = createError('Failed to validate JWT:', {
      cause: err,
      type: UnauthorizedError,
    });
    throw error;
  }
}

/**
 * Remove all incoming headers with the configured prefix
 *
 * @param config
 * @param req
 */
export function removeAllIncomingAuthHeaders(
  config: ConfigData,
  req: http.IncomingMessage,
): void {
  // Remove all incoming headers with the configured prefix
  const authHeaderPrefix = config.jwt.authHeaderPrefix;
  const headersToRemove = Object.keys(req.headers).filter((headerName) =>
    headerName.toLowerCase().startsWith(authHeaderPrefix.toLowerCase()),
  );

  headersToRemove.forEach((headerName) => {
    delete req.headers[headerName];
    logger.debug(`Removed incoming header: ${headerName}`);
  });
}

/**
 * Rewrite the request URL by stripping the proxy base URL.  For example:
 * if the `baseUrl` is "/api", the change will be:
 *
 * - /api/v1/resource -> /v1/resource
 *
 * @param proxyBaseUrl
 * @param req
 */
export function rewriteBaseUrlByStrippingBaseUrl(
  req: http.IncomingMessage,
  proxyBaseUrl?: string,
): void {
  if (proxyBaseUrl && req.url) {
    // Remove the base URL prefix from the incoming request URL
    const baseUrlPattern = proxyBaseUrl.endsWith('/')
      ? proxyBaseUrl.slice(0, -1)
      : proxyBaseUrl;

    if (req.url.startsWith(baseUrlPattern)) {
      const originalUrl = req.url;
      req.url = req.url.substring(baseUrlPattern.length) || '/';
      logger.debug(`URL rewrite: ${originalUrl} -> ${req.url}`);
    } else {
      // errorHandler(`Request URL ${req.url} does not match proxy base URL ${proxyBaseUrl}`, res);
      throw new BadRequestError(
        `Request URL ${req.url} does not match proxy base URL ${proxyBaseUrl}`,
      );
    }
  }
}

/**
 * Handle errors that occur during request processing
 *
 * @param error - The error that occurred
 * @param res - The HTTP response object
 */
export function errorHandler(error: unknown, res: http.ServerResponse) {
  let status: number;
  let message: string;
  let errorName: string;

  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
    errorName = error.name;
  } else if (error instanceof Error) {
    status = InternalServerError.status;
    message = error.message;
    errorName = error.name;
  } else {
    status = InternalServerError.status;
    message = `Unknown error: ${error}`;
    errorName = 'UnknownError';
  }

  if (errorName === 'UnknownError') {
    logger.error(`${errorName} ${status}: ${message}`);
  } else {
    logger.error(`${errorName} ${status}: ${message}`, error as Error);
  }

  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: errorName, message }));
}
