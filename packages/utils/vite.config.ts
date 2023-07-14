import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      tsconfigPath: './tsconfig-build.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        h3: resolve(__dirname, 'src/h3.ts'),
        regex: resolve(__dirname, 'src/regex.ts'),
        text: resolve(__dirname, 'src/text.ts'),
        time: resolve(__dirname, 'src/time.ts'),
        uid: resolve(__dirname, 'src/uid.ts'),
        wallet: resolve(__dirname, 'src/wallet.ts'),
      },
      name: 'types',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: ['h3-js', 'luxon', 'viem'],
    },
  },
});
