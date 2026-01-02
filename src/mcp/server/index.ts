import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  jules,
  JulesClient,
  JulesQuery,
  JulesDomain,
  SessionConfig,
  Activity,
} from '../../index.js';

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
            name: 'jules_create_session',
            description:
              'Creates a new Jules session or automated run to perform code tasks.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The task for the agent.',
                },
                repo: {
                  type: 'string',
                  description: 'GitHub repository (owner/repo).',
                },
                branch: { type: 'string', description: 'Target branch.' },
                interactive: {
                  type: 'boolean',
                  description:
                    'If true, waits for plan approval. Defaults to false (automated run).',
                },
                autoPr: {
                  type: 'boolean',
                  description:
                    'Automatically create a PR on completion. Defaults to true.',
                },
              },
              required: ['prompt', 'repo', 'branch'],
            },
          },
          {
            name: 'jules_get_session_status',
            description:
              'Retrieves the current state, URL, and latest activities of a session.',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                activityLimit: {
                  type: 'number',
                  description:
                    'Number of recent activities to fetch. Defaults to 5.',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'jules_interact',
            description:
              'Interacts with an active session (approving plans or sending messages).',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                action: {
                  type: 'string',
                  enum: ['approve', 'send', 'ask'],
                  description:
                    "'ask' waits for a reply, 'send' is fire-and-forget.",
                },
                message: {
                  type: 'string',
                  description: "Required for 'send' and 'ask'.",
                },
              },
              required: ['sessionId', 'action'],
            },
          },
          {
            name: 'jules_list_sessions',
            description: 'Lists recent Jules sessions.',
            inputSchema: {
              type: 'object',
              properties: {
                pageSize: { type: 'number', default: 10 },
              },
            },
          },
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
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case 'jules_create_session':
            return await this.handleCreateSession(args);
          case 'jules_get_session_status':
            return await this.handleGetSessionStatus(args);
          case 'jules_interact':
            return await this.handleInteract(args);
          case 'jules_list_sessions':
            return await this.handleListSessions(args);
          case 'jules_select':
            return await this.handleSelect(args);
          default:
            throw new Error(`Tool not found: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleCreateSession(args: any) {
    const config: SessionConfig = {
      prompt: args.prompt,
      source: { github: args.repo, branch: args.branch },
      requireApproval: args.interactive,
      autoPr: args.autoPr !== undefined ? args.autoPr : true,
    };

    const result = args.interactive
      ? await this.julesClient.session(config)
      : await this.julesClient.run(config);

    return {
      content: [{ type: 'text', text: `Session created. ID: ${result.id}` }],
    };
  }

  private async handleGetSessionStatus(args: any) {
    const sessionId = args.sessionId as string;
    if (!sessionId) throw new Error('sessionId is required');

    const client = this.julesClient.session(sessionId);
    // TODO: Verify session existence? info() will likely throw if not found or unauthorized.

    const info = await client.info();
    const historyIter = client.history();
    const allActivities: Activity[] = [];
    for await (const act of historyIter) {
      allActivities.push(act);
    }

    const limit = (args.activityLimit as number) || 5;
    const recentActivities = allActivities.slice(-limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { state: info.state, url: info.url, recentActivities },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleInteract(args: any) {
    const { sessionId, action, message } = args;
    if (!sessionId) throw new Error('sessionId is required');

    const client = this.julesClient.session(sessionId as string);

    if (action === 'approve') {
      await client.approve();
      return { content: [{ type: 'text', text: 'Plan approved.' }] };
    }

    if (action === 'send') {
      if (!message) throw new Error("Message is required for 'send' action");
      await client.send(message);
      return { content: [{ type: 'text', text: 'Message sent.' }] };
    }

    if (action === 'ask') {
      if (!message) throw new Error("Message is required for 'ask' action");
      const reply = await client.ask(message);
      return {
        content: [{ type: 'text', text: `Agent reply: ${reply.message}` }],
      };
    }

    throw new Error(`Invalid action: ${action}`);
  }

  private async handleListSessions(args: any) {
    const cursor = this.julesClient.sessions({
      pageSize: args?.pageSize || 10,
    });
    const sessions = await cursor; // Gets first page
    return {
      content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
    };
  }

  private async handleSelect(args: any) {
    const query = args?.query as JulesQuery<JulesDomain>;
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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jules MCP Server running on stdio');
  }
}
