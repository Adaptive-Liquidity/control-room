const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/services/**/*.{ts,tsx}',
    'src/app/api/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  // Global floor — ratchet up as Agent HQ modules land (compose/scope get per-path targets in later cycles)
  coverageThreshold: {
    global: {
      branches: 7,
      functions: 12,
      lines: 14,
      statements: 14,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
