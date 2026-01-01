#!/usr/bin/env node
import { JulesMCPServer } from './server/index.js';

// The server uses the default 'jules' instance which reads API key from env
const server = new JulesMCPServer();
server.run().catch((err) => {
  console.error('Fatal MCP Server Error:', err);
  process.exit(1);
});
