import { defineConfig } from 'tsup';
import { dependencies } from './package.json';

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
      h3: './src/h3.ts',
      regex: './src/regex.ts',
      text: './src/text.ts',
      time: './src/time.ts',
      uid: './src/uid.ts',
      wallet: './src/wallet.ts',
    },
    platform: 'neutral',
    treeshake: true,
    dts: true,
    sourcemap: true,
    splitting: false,
    clean: true,
    format: ['esm', 'cjs'],
    external: Object.keys(dependencies),
  },
]);
