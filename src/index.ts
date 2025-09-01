import type * as http from 'http';

// Kickoff the startup process and return config data
import { getConfigData } from './start';

import { createLogger } from './core';
import { createProxyServer } from './services/proxy.service';

const logger = createLogger();

// Start measuring startup time
const start = process.hrtime();


/**
 * Handles the SIGINT and SIGTERM signal to gracefully shut down the application.
 */
function handleSigint(server: http.Server): void {
  function shutdown(signal: string) {
    logger.warn(`Received ${signal}, shutting down proxy server gracefully...`);
    server.close();
    logger.info('Server shut down gracefully');
  }

  process.on('SIGINT', async () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', async () => {
    shutdown('SIGTERM');
  });
}

/**
 * Start the proxy server
 */
async function main(): Promise<void> {
  const config = await getConfigData();
  const server = createProxyServer(config);

  // response to SIGINT and SIGTERM 
  handleSigint(server);

  // Start the server
  const port = config.getProxyPort();
  logger.info(`Starting proxy server on port ${port}`);
  server.listen(port);
}

// Run main
main()
  .then(() => {
    const end = process.hrtime(start);
    const duration = end[0] * 1e3 + end[1] * 1e-6;
    logger.info(`Proxy server started successfully in ${duration.toFixed(2)} ms`);
  })
  .catch((err) => {
    logger.error(`Failed to start proxy server: ${err.message}`);
    process.exit(1);
  });
