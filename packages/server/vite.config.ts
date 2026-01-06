import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        'auth-firebase': 'src/auth/strategies/firebase.ts',
        'auth-memory': 'src/auth/strategies/memory.ts',
        'auth-rbac': 'src/auth/strategies/rbac.ts',
        node: 'src/node/proxy.ts',
        gas: 'src/gas/index.ts',
      },
      name: 'modjules-server',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: [
        // Workspace dependency
        'modjules',

        // Peer dependencies
        'firebase-admin',
        /firebase-admin\/.*/,

        // Node.js Built-ins
        'node:buffer',
        'node:crypto',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:process',
        'node:stream',
        'node:timers/promises',
        'node:util',
        'node:os',
        'buffer',
        'crypto',
        'fs',
        'fs/promises',
        'path',
        'process',
        'stream',
        'util',
        'os',
      ],
    },
  },
  plugins: [dts()],
});
