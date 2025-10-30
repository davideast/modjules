import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'next-devtools-mcp@latest'],
    cwd: './examples/jules-agent',
  });

  const client = new Client({
    name: 'mcp-client',
    version: '1.0.0',
  });

  await client.connect(transport);
  console.log('MCP client connected.');

  // Check for a port argument passed from the command line
  const portArg = process.argv.find((arg) => arg.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : undefined;

  if (!port) {
    console.error('Error: Port must be provided via --port=<number> argument.');
    process.exit(1);
  }

  console.log(`Using port ${port}.`);

  console.log('Calling get_errors tool via nextjs_runtime...');
  const result = await client.callTool({
    name: 'nextjs_runtime',
    arguments: {
      action: 'call_tool',
      toolName: 'get_errors',
      port: port, // Provide the port from the argument
    },
  });
  console.log('get_errors result:', JSON.stringify(result, null, 2));

  transport.close();
}

main().catch(console.error);
