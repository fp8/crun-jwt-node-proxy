import { JLogger, LoggerFactory } from 'jlog-facade';

export const LOGGER_NAME = 'ts-app';
const mainLogger = LoggerFactory.getLogger(LOGGER_NAME);

export function createLogger(name?: string): JLogger {
  if (name === undefined || name === '') {
    return mainLogger;
  } else {
    return LoggerFactory.getLogger(`${LOGGER_NAME}.${name}`);
  }
}
