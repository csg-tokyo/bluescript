export default {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests', '<rootDir>/src'],
      testPathIgnorePatterns: ['/integration/'],
      setupFilesAfterEnv: ['<rootDir>/tests/global-mocks.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/integration-setup.ts'],
      maxWorkers: 1,
    },
  ],
};