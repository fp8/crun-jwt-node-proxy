import type { ProxyTarget } from 'http-proxy';
import * as fs from 'fs';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

// Importing directly from logger.ts file to avoid circular dependency issues
import { createLogger } from '../core/logger';

const logger = createLogger('config.dto');

export class JwtConfig {
  @IsString()
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  audience!: string;

  @IsOptional()
  @IsNumber()
  clockTolerance = 30; // 30 seconds tolerance for jwt exp and nbf claims

  @IsOptional()
  @IsNumber()
  maxCacheAge = 3600000 * 24; // 3600000 milliseconds is 1 hour, default is 24 hours

  @IsObject()
  filter: Record<string, string> = {};

  @IsObject()
  mapper: Record<string, string> = {};
}

export class ProxyConfig {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  certPath?: string;

  @IsOptional()
  @IsString()
  passphrase?: string;
}

export class ConfigData {
  @IsString()
  name!: string;

  @IsNumber()
  port!: number;

  @Type(() => JwtConfig)
  @ValidateNested()
  jwt!: JwtConfig;

  @Type(() => ProxyConfig)
  @ValidateNested()
  proxy!: ProxyConfig;

  getProxyPort(): number {
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      logger.debug(`Using PORT from environment: ${port}`);
      return port;
    } else {
      return this.port;
    }
  }

  getProxyTarget(): ProxyTarget {
    const url = getProxyURL(this.proxy);

    // If port is not specified in the URL, use default ports based on protocol
    const port = url.port
      ? parseInt(url.port, 10)
      : url.protocol === 'https:'
        ? 443
        : 80;

    const output: ProxyTarget = {
      host: url.hostname,
      port,
      protocol: url.protocol,
    };

    // Retrive the client certificate to use if target is https
    if (this.proxy.certPath) {
      try {
        output.pfx = fs.readFileSync(this.proxy.certPath);
        output.passphrase = this.proxy.passphrase || '';
      } catch (err) {
        throw new Error(
          `Failed to read certificate file: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    logger.debug(`Proxy target: ${JSON.stringify(output)}`);
    return output;
  }
}

/**
 * This function checks if the `PROXY_TARGET` environment variable is set,
 * and if so, uses that as the proxy URL. Otherwise, it uses the URL from
 * the provided `proxyConfig`.
 *
 * @param proxyConfig
 * @returns
 */
function getProxyURL(proxyConfig: ProxyConfig): URL {
  let proxyUrl: string;
  if (process.env.PROXY_TARGET) {
    proxyUrl = process.env.PROXY_TARGET;
    logger.debug(`Using PROXY_TARGET from environment: ${proxyUrl}`);
  } else {
    proxyUrl = proxyConfig.url;
    logger.debug(`Using PROXY_TARGET from config: ${proxyUrl}`);
  }
  const output = new URL(proxyUrl);

  return output;
}
