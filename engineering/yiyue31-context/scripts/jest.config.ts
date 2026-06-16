import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Map .js extension imports to .ts files for NodeNext module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      diagnostics: {
        // TS151002: NodeNext module kind warning — expected with NodeNext resolution
        ignoreCodes: [151002],
      },
    }],
  },
  // runInBand is set via CLI flag --runInBand in package.json scripts
};

export default config;
