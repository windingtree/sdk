import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      include: ['./packages/**/*.spec.ts', './examples/**/*.spec.ts'],
    },
  },
]);
