import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: 'src/index.ts',
      },
      name: 'modjules-auth',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.mjs`,
    },
  },
  plugins: [dts()],
});
