module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest-setup.ts'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    'obsidian': '<rootDir>/tests/mocks/obsidian.ts'
  },
  testTimeout: 10000, // 10 second timeout per test
  maxWorkers: 1 // Run tests serially to avoid conflicts
};