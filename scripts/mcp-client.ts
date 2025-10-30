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

  const tools = await client.listTools();
  console.log('Available tools:', tools);

  if (tools.tools.some((tool) => tool.name === 'get_errors')) {
    console.log('Calling get_errors tool...');
    const result = await client.callTool({
      name: 'get_errors',
    });
    console.log('get_errors result:', result);
  } else {
    console.log('get_errors tool not found.');
  }

  transport.close();
}

main().catch(console.error);
