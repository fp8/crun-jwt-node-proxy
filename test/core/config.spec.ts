import '../testlib';

import { ConfigStore } from '@fp8/simple-config';
import { createConfigStore } from '../../src/core/config';
import { ConfigData, JwtConfig } from '../../src/dto/config.dto';

describe('createConfigStore', () => {
  const configStore = createConfigStore();

  it('should create a ConfigStore instance with ConfigData', () => {
    expect(configStore).toBeInstanceOf(ConfigStore);

    const configData = configStore.data;
    expect(configData).toBeInstanceOf(ConfigData);

    const jwtConfig = configData.jwt;
    expect(jwtConfig).toBeInstanceOf(JwtConfig);

    // The name is sourced from the etc/utest/config.json file
    expect(configData.name).toEqual('typescript-start-utest');
  });

  it('jwt filter', () => {
    const jwtConfig = configStore.data.jwt;
    console.log('JWT Config:', jwtConfig.filter);

    // Extract regex pattern from string that starts with /
    const emailFilter = jwtConfig.filter.email;
    const regexPattern =
      emailFilter.startsWith('/') && emailFilter.endsWith('/')
        ? emailFilter.slice(1, -1) // Remove leading and trailing /
        : emailFilter;

    const regex = new RegExp(regexPattern);

    expect(regex.test('user@test.com')).toBe(true);
    expect(regex.test('user@other.com')).toBe(false);
  });
});
