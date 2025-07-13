import type { JwtConfig } from '../dto/config.dto';

import { isEmpty } from 'jlog-facade';
import { IJwtClaim, createLogger } from '../core';

const logger = createLogger('jwt.validator');

interface IJwtMatcher {
  field: string;
  value?: string;
  regex?: RegExp;
}

/**
 * This class validates JWT using the configured filter and out a mapper to
 * create the http header
 */
export class JwtValidator {
  protected filter: IJwtMatcher[] = [];
  protected mapper: Record<string, string> = {};

  constructor(config: JwtConfig) {
    if (config.filter) {
      for (const [key, value] of Object.entries(config.filter)) {
        if (value.startsWith('/')) {
          const regexPattern = value.slice(1, -1); // Remove leading and trailing /
          this.filter.push({ field: key, regex: new RegExp(regexPattern) });
        } else {
          this.filter.push({ field: key, value });
        }
      }
    }

    this.mapper = config.mapper || {};
  }

  /**
   * Validate a JWT claim against the configured filter and mapper.
   *
   * @param input
   * @returns
   */
  public validate(input: IJwtClaim): void {
    if (!input) {
      throwValidationError('No JWT claim provided for validation');
    }

    // Check jwt claim against filter
    for (const matcher of this.filter) {
      const entry = input[matcher.field];

      // Is there is a matcher and entry is empty, then validation fails
      if (isEmpty(entry)) {
        throwValidationError(`No '${matcher.field}' found in JWT claim`);
      }

      // If entry is an array
      if (Array.isArray(entry)) {
        // For arrays, check if ANY element matches the filter (OR logic)
        // This is typical for role-based validation where a user might have multiple roles
        let hasMatch = false;
        for (const item of entry) {
          if (this.validateEntry(item, matcher)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) {
          throwValidationError(
            `Array ${JSON.stringify(entry)} did not match '${matcher.field}'`,
          );
        }
      } else {
        if (!this.validateEntry(entry, matcher)) {
          throwValidationError(
            `Entry '${entry}' for '${matcher.field}' failed matcher`,
          );
        }
      }
    }
  }

  /**
   * Map the JWT claim to the configured mapper.
   *
   * @param input
   * @returns
   */
  public map(input: IJwtClaim): Record<string, string> {
    if (!input) {
      logger.info('JwtValidator.map failed: No JWT claim provided for mapping');
      return {};
    }
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.mapper)) {
      const entry = input[key];
      if (entry !== undefined) {
        if (Array.isArray(entry)) {
          mapped[value] = entry.join(',');
        } else if (typeof entry === 'object') {
          mapped[value] = JSON.stringify(entry);
        } else {
          mapped[value] = entry.toString();
        }
      }
    }
    return mapped;
  }

  private validateEntry(entry: string | number, matcher: IJwtMatcher): boolean {
    if (matcher.regex) {
      return matcher.regex.test(entry.toString());
    }
    if (matcher.value !== undefined) {
      return entry == matcher.value; // Use loose equality to handle string/number conversions
    }
    return true;
  }
}

function throwValidationError(message: string): never {
  logger.warn(`JwtValidator.validate failed: ${message}`);
  throw new Error(message);
}
