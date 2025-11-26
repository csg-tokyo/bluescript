export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  setupFilesAfterEnv: ['<rootDir>/tests/global-mocks.ts'],
};