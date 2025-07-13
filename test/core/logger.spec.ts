import { LOGGER_NAME, createLogger } from '../../src/core/logger';

describe('Logger', () => {
  it('should create a logger with the default name', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    // `as any` is not needed in the next version of jlog-facade
    expect((logger as any).name).toBe(LOGGER_NAME);
  });

  it('should return the main logger when no name is provided', () => {
    const anotherMainLogger = createLogger('');
    // `as any` is not needed in the next version of jlog-facade
    expect((anotherMainLogger as any).name).toBe(LOGGER_NAME);
  });

  it('should create a logger with a custom name', () => {
    const customName = 'customLogger';
    const logger = createLogger(customName);
    expect(logger).toBeDefined();
    expect((logger as any).name).toBe(`${LOGGER_NAME}.customLogger`);
  });
});
