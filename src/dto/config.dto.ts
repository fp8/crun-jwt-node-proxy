import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsString, ValidateNested } from 'class-validator';

import { JwtValidator } from '../jwt/validator';

export class JwtConfig {
  @IsObject()
  filter: Record<string, string> = {};

  @IsObject()
  mapper: Record<string, string> = {};
}

export class ConfigData {
  @IsString()
  name!: string;

  @IsNumber()
  port!: number;

  @Type(() => JwtConfig)
  @ValidateNested()
  jwt!: JwtConfig;

  public getJwtValidator(): JwtValidator {
    return new JwtValidator(this.jwt);
  }
}
