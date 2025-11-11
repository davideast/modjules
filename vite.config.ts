import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        browser: 'src/browser.ts',
      },
      name: 'julets',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ['idb'],
    },
  },
  plugins: [dts()],
});
