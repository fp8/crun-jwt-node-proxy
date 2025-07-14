// Kickoff the startup process and return config data
import { getConfigData } from './start';

import * as http from 'http';
import * as httpProxy from 'http-proxy';

import { createError, createLogger, IJwtClaim } from './core';
import { ConfigData } from './dto/config.dto';
import { JwtService } from './services/jwt.service';

export const logger = createLogger();

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

async function main(): Promise<void> {
  const config = await getConfigData();
  const server = createProxyServer(config);

  // response to SIGINT
  process.on('SIGINT', () => {
    // ToDo: do any cleanup if necessary
    logger.warn('Received SIGINT, shutting proxy server...');
    server.close((err) => {
      if (err) {
        logger.error(
          `Error occurred while shutting down: ${err.message}.  Forcing exit.`,
        );
        process.exit(0);
      } else {
        logger.info('Server shut down gracefully');
      }
    });
  });

  // Start the server
  const port = config.getProxyPort();
  logger.info(`Starting proxy server on port ${port}`);
  server.listen(port);
}

// Run main
main()
  .then(() => logger.info('Proxy server started successfully'))
  .catch((err) => {
    logger.error(`Failed to start proxy server: ${err.message}`);
    process.exit(1);
  });
