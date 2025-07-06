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
  @IsUrl()
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

  getProxyTarget(): ProxyTarget {
    const url = new URL(this.proxy.url);
    const port = url.port
      ? parseInt(url.port, 10)
      : url.protocol === 'https:'
        ? 443
        : 80;

    const output: ProxyTarget = {
      host: url.host,
      port,
      protocol: url.protocol,
    };

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

    return output;
  }
}
