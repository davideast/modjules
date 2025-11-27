import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // 'server' mode is required to run the proxy and Firebase Admin SDK
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    port: 3000,
  },
});
