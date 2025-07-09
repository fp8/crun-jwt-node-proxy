// Kickoff the startup process and return config data
import { CONFIG_DATA } from './start';

import * as http from 'http';
import * as httpProxy from 'http-proxy';

import { createError, createLogger, IJwtClaim } from './core';
import { JwtService } from './services/jwt.service';

export const logger = createLogger();

const jwtService = new JwtService(CONFIG_DATA.jwt);

//
// Create a proxy server with custom application logic
// https://request-echo-839315814860.europe-west1.run.app
const options: httpProxy.ServerOptions = {
  target: CONFIG_DATA.getProxyTarget(),
  changeOrigin: true,
};
export const proxy = httpProxy.createProxyServer(options);

const server = http.createServer(async function (req, res) {
  let claims: IJwtClaim;

  try {
    const token = req.headers['authorization']?.split(' ')[1];
    claims = await jwtService.validateToken(token);
  } catch (err) {
    const error = createError(err);
    logger.error(`Failed to decode JWT: ${error.message}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', message: error.message }));
    return;
  }

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
  proxy.web(req, res);
});

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

const port = CONFIG_DATA.getProxyPort();
logger.info(`Starting proxy server on port ${port}`);
server.listen(port);
