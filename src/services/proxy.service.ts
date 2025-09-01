import * as http from 'http';
import * as httpProxy from 'http-proxy';

import { createError, createLogger, IJwtClaim } from '../core';
import { ConfigData } from '../dto/config.dto';
import { JwtService } from '../services/jwt.service';

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

  const server = http.createServer(async (req, res) => {
    let claims: IJwtClaim;

    try {
      const token = req.headers['authorization']?.split(' ')[1];
      // ToDo: Add secrets check here


      claims = await jwtService.validateToken(token);
    } catch (err) {
      const error = createError(err);
      logger.error(`Failed to decode JWT: ${error.message}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Unauthorized', message: error.message }),
      );
      return;
    }

    // Remove all incoming headers with the configured prefix
    const authHeaderPrefix = config.jwt.authHeaderPrefix;
    const headersToRemove = Object.keys(req.headers).filter((headerName) =>
      headerName.toLowerCase().startsWith(authHeaderPrefix.toLowerCase()),
    );

    headersToRemove.forEach((headerName) => {
      delete req.headers[headerName];
      logger.debug(`Removed incoming header: ${headerName}`);
    });

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
    const proxyBaseUrl = config.getProxyBaseUrl();
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
        const errorMessage = `Request URL ${req.url} does not match proxy base URL ${proxyBaseUrl}`;
        logger.warn(errorMessage);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Bad Request', message: errorMessage }),
        );
        return;
      }
    }

    proxy.web(req, res);
  });

  return server;
}