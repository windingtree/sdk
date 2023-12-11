import { defineConfig } from 'tsup';

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
    },
    platform: 'neutral',
    treeshake: true,
    dts: { resolve: true },
    sourcemap: true,
    splitting: false,
    clean: true,
    format: ['esm', 'cjs'],
  },
]);
