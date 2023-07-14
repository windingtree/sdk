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
      entry: [resolve(__dirname, 'src/index.ts')],
      name: 'queue',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
  },
});
