import { defineConfig } from 'tsup';
import { dependencies } from './package.json';

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
      local: './src/local.ts',
      memory: './src/memory.ts',
      level: './src/level.ts',
    },
    platform: 'neutral',
    treeshake: true,
    // dts: { resolve: true },
    sourcemap: true,
    splitting: false,
    format: ['esm', 'cjs'],
    external: Object.keys(dependencies),
  },
]);
