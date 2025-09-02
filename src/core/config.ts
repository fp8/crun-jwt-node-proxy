import { ConfigStore, EntityCreationError } from '@fp8/simple-config';
import { Loggable } from 'jlog-facade';

import { createLogger } from './logger';
import { createError, fetch } from './helpers';
import { ConfigData } from '../dto/config.dto';

const logger = createLogger('core.config');

/**
 * Must make sure that the GOOGLE_CLOUD_PROJECT environment variable is set
 * before creating the ConfigStore, as it is used to determine the project ID.
 */
export async function prepareProjectEnv(): Promise<void> {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    logger.warn(
      'GOOGLE_CLOUD_PROJECT environment variable is not set. ' +
        'Using metadata to determine the project ID.',
    );

    try {
      const projectId = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/project/project-id',
        { 'Metadata-Flavor': 'Google' },
      );
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
      logger.info(`Project ID set to: ${process.env.GOOGLE_CLOUD_PROJECT}`);
    } catch (err) {
      const error = createError(err);
      if (error.message.includes('ENOTFOUND metadata.google.internal')) {
        const message =
          'When runnning outside of Google Cloud, you must set the GOOGLE_CLOUD_PROJECT environment variable. [ENOTFOUND metadata.google.internal]';
        throw createError(message, { cause: err });
      } else {
        throw err;
      }
    }
  }
}

/**
 * Create config store for ConfigData.
 *
 * @returns
 */
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
