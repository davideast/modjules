#!/usr/bin/env node
import { Command } from 'commander';
import { JulesMCPServer } from './server/index.js';
import { resolveApiKey } from './config.js';
import { jules } from 'modjules';
import { doctorAction } from './commands/doctor.js';
import { registerAction } from './commands/register.js';
import { configAction } from './commands/config.js';

const program = new Command();

program
  .name('modjules-mcp')
  .description('Jules MCP Server CLI')
  .version('0.1.0');

// Default action: Run the server
program.action(async () => {
  const apiKey = resolveApiKey();
  const client = apiKey ? jules.with({ apiKey }) : jules;

  const server = new JulesMCPServer(client);
  server.run().catch((err) => {
    console.error('Fatal MCP Server Error:', err);
    process.exit(1);
  });
});

program
  .command('doctor')
  .description('Check environment and configuration health')
  .action(doctorAction);

program
  .command('register')
  .description('Register modjules-mcp with other tools (Cursor, Claude, etc.)')
  .argument('[tool]', 'Tool to register with (cursor, claude, gemini)')
  .action(registerAction);

program
  .command('config')
  .description('Configure the Jules API Key')
  .option('-k, --key <api-key>', 'API key to save (skips interactive prompt)')
  .action(configAction);

program.parse(process.argv);
