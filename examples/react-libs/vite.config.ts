import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    /** @ignore */
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: [
        resolve(__dirname, 'src/index.ts'),
        resolve(__dirname, 'src/providers/index.ts'),
        resolve(__dirname, 'src/utils/index.ts'),
      ],
      name: 'examples-react-libs',
      formats: ['es'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'vite'],
      input: {
        index: resolve(__dirname, 'src/index.ts'),
        providers: resolve(__dirname, 'src/providers/index.ts'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
