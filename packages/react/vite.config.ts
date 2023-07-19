import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { devDependencies } from './package.json';

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
      entry: {
        index: './src/index.ts',
        providers: './src/providers/index.ts',
        utils: './src/utils/index.ts',
      },
      name: '@windingtree/sdk-react',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: Object.keys(devDependencies),
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
