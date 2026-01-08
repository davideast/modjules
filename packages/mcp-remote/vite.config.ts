import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    // Force Node.js target to prevent browser externalization issues
    ssr: true,
    target: 'node18',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        hono: 'src/hono.ts',
      },
      name: 'modjules-mcp-remote',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'hono',
        '@modelcontextprotocol/sdk',
        'modjules',
        // Node.js Built-ins
        'assert', 'buffer', 'crypto', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'stream', 'url', 'util', 'zlib',
        'node:buffer', 'node:crypto', 'node:fs', 'node:fs/promises', 'node:path', 'node:process', 'node:stream', 'node:util', 'node:os'
      ],
      output: {
        // Explicitly set entry file names for ESM
        entryFileNames: '[name].mjs',
      }
    },
  },
  plugins: [dts()],
});
