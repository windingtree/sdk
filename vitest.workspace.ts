import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'packages:node',
      environment: 'node',
      include: ['./packages/**/*.spec.ts'],
      testTimeout: 10000,
    },
  },
  {
    test: {
      name: 'e2e',
      environment: 'node',
      include: ['./examples/e2e-tests/**/*.spec.ts'],
    },
  },
]);
