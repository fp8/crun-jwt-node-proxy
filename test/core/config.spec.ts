import '../testlib';

import { ConfigStore } from '@fp8/simple-config';
import { createConfigStore } from '../../src/core/config';
import { ConfigData, JwtConfig } from '../../src/dto/config.dto';

describe('createConfigStore', () => {
  let configStore: ConfigStore<ConfigData>;

  beforeAll(() => {
    // Ensure the environment variable is set for the test
    if (process.env.GOOGLE_CLOUD_PROJECT === undefined) {
      process.env.GOOGLE_CLOUD_PROJECT = 'fp8netes-dev';
    }
    // Set configStore after env update
    configStore = createConfigStore();
  });

  it('should create a ConfigStore instance with ConfigData', () => {
    expect(configStore).toBeInstanceOf(ConfigStore);

    const configData = configStore.data;
    expect(configData).toBeInstanceOf(ConfigData);

    const jwtConfig = configData.jwt;
    expect(jwtConfig).toBeInstanceOf(JwtConfig);

    // The name is sourced from the etc/utest/config.json file
    expect(configData.name).toEqual('crun-jwt-proxy-utest');
  });

  it('jwt filter', () => {
    const gcloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const jwtConfig = configStore.data.jwt;
    console.log('JWT Config:', jwtConfig.filter);

    expect(gcloudProject).toBeDefined();
    expect(jwtConfig.issuer).toEqual(
      `https://securetoken.google.com/${gcloudProject}`,
    );
    expect(jwtConfig.audience).toEqual(gcloudProject);
    expect(jwtConfig.clockTolerance).toEqual(33); // Different from default 30 seconds
    expect(jwtConfig.maxCacheAge).toEqual(3600000 * 24); // 24 hours in milliseconds

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
