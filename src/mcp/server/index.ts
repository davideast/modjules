import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { jules, JulesClient, JulesQuery, JulesDomain } from '../../index.js';

export class JulesMCPServer {
  private server: Server;
  private julesClient: JulesClient;

  constructor(client: JulesClient = jules) {
    this.julesClient = client;
    this.server = new Server(
      {
        name: 'jules-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'jules_select',
            description:
              'Execute a jules.select() query to filter sessions or activities.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'object',
                  description:
                    'The JulesQuery object defining the selection criteria.',
                  properties: {
                    from: {
                      type: 'string',
                      enum: ['sessions', 'activities'],
                      description: 'The domain to query from.',
                    },
                    select: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Fields to project.',
                    },
                    where: {
                      type: 'object',
                      description: 'Filter criteria.',
                    },
                    include: {
                      type: 'object',
                      description: 'Related data to include.',
                    },
                    limit: {
                      type: 'number',
                      description: 'Maximum number of results to return.',
                    },
                    offset: {
                      type: 'number',
                      description: 'Number of results to skip.',
                    },
                  },
                  required: ['from'],
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'jules_select') {
        try {
          const query = request.params.arguments
            ?.query as JulesQuery<JulesDomain>;
          if (!query) {
            throw new Error('Query argument is required');
          }

          const results = await this.julesClient.select(query);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error executing select: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Tool not found: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jules MCP Server running on stdio');
  }
}
