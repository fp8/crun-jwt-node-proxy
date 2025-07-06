import { ConfigStore, EntityCreationError } from '@fp8/simple-config';
import { Loggable } from 'jlog-facade';

import { createLogger } from './logger';
import { ConfigData } from '../dto/config.dto';

const logger = createLogger('core.config');

export function createConfigStore(): ConfigStore<ConfigData> {
  try {
    return new ConfigStore(ConfigData);
  } catch (err) {
    if (err instanceof EntityCreationError) {
      logger.error(
        `Failed to create ConfigStore: ${err.message}`,
        Loggable.of('fields', err.fields),
      );
    }
    throw err;
  }
}
