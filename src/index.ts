// Kickoff the startup process and return config data
import { CONFIG_DATA } from './start';

import * as fs from 'fs';
import * as httpProxy from 'http-proxy';

import { createError, createLogger, decodeJwt, IJwtClaim } from './core';
export const logger = createLogger();

const cert = fs.readFileSync('./certs/client-identity.p12');

//
// Create a proxy server with custom application logic
//
const options: httpProxy.ServerOptions = {
  target: {
    host: 'typesense-623356595940.europe-west1.run.app',
    port: 443,
    protocol: 'https:',
    pfx: cert,
    passphrase: '',
  },
  changeOrigin: true,
};
export const proxy = httpProxy.createProxyServer(options);

const validator = CONFIG_DATA.getJwtValidator();
proxy.on('proxyReq', function (proxyReq, req, res, _options) {
  let claims: IJwtClaim;
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    claims = decodeJwt(token);
    validator.validate(claims);
  } catch (err) {
    const error = createError(err);
    logger.error(`Failed to decode JWT: ${error.message}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', message: error.message }));
    return;
  }

  // Map the JWT claims to headers
  const headers = validator.map(claims);
  logger.info(`Mapping JWT claims to headers: ${JSON.stringify(headers)}`);
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      proxyReq.setHeader(key, value);
    } else {
      logger.warn(`Skipping undefined header for key: ${key}`);
    }
  }
});

logger.info(`Starting proxy server on port ${CONFIG_DATA.port}`);
proxy.listen(CONFIG_DATA.port);
