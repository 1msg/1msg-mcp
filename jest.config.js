/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  testTimeout: 15000,
  // zod@4 + parallel workers can flake on module resolution; keep CI deterministic
  maxWorkers: 1,
  forceExit: true,
};
