import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  JulesClient,
  JulesQuery,
  JulesDomain,
  SessionConfig,
  Activity,
} from '../../index.js';
import { truncateToTokenBudget } from '../tokenizer.js';
import { toLightweight } from '../lightweight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class JulesMCPServer {
  private server: Server;
  private julesClient: JulesClient;

  constructor(julesClient: JulesClient) {
    this.julesClient = julesClient;
    this.server = new Server(
      {
        name: 'modjules-local',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return this.handleListPrompts();
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return this.handleGetPrompt(request.params);
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return this._listTools();
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case 'jules_create_session':
            return await this.handleCreateSession(args);
          case 'jules_session_state':
            return await this.handleSessionState(args);
          case 'jules_session_timeline':
            return await this.handleSessionTimeline(args);
          case 'jules_get_session_status':
            return await this.handleGetSessionStatus(args);
          case 'jules_interact':
            return await this.handleInteract(args);
          case 'jules_list_sessions':
            return await this.handleListSessions(args);
          case 'jules_select':
            return await this.handleSelect(args);
          case 'jules_get_session_analysis_context':
            return await this.handleGetSessionAnalysisContext(args);
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

  private async handleListPrompts() {
    return {
      prompts: [
        {
          name: 'analyze_session',
          description: 'Analyze a Jules session with the LLM',
          arguments: [
            {
              name: 'sessionId',
              description: 'The Session ID to analyze',
              required: true,
            },
          ],
        },
      ],
    };
  }

  private async handleGetPrompt(args: any) {
    const { name, arguments: promptArgs } = args;

    if (name === 'analyze_session') {
      const sessionId = promptArgs?.sessionId as string;
      if (!sessionId) {
        throw new Error('sessionId is required for analyze_session prompt');
      }

      const content = await this.getAnalysisContent(sessionId);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: content,
            },
          },
        ],
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  }

  private async getAnalysisContent(sessionId: string): Promise<string> {
    const client = this.julesClient.session(sessionId);
    const snapshot = await client.snapshot();

    // Read template from context/session-analysis.md
    // Resolve path relative to this file: src/mcp/server/index.ts -> ../../../context/session-analysis.md
    const templatePath = path.resolve(
      __dirname,
      '../../../context/session-analysis.md',
    );
    let templateContent;

    try {
      templateContent = await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read prompt template at ${templatePath}. Ensure you are running from the project root.`,
      );
    }

    return templateContent.replace(
      '{INSERT_SNAPSHOT_JSON_HERE}',
      JSON.stringify(snapshot.toJSON(), null, 2),
    );
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
    const recentActivities = allActivities
      .slice(-limit)
      .map((a) => toLightweight(a));

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

  private async handleGetSessionAnalysisContext(args: any) {
    const sessionId = args?.sessionId as string;
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const content = await this.getAnalysisContent(sessionId);

    return {
      content: [
        {
          type: 'text',
          text: content,
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
    const query = args?.query as JulesQuery<JulesDomain> & { mode?: string };
    if (!query) {
      throw new Error('Query argument is required');
    }
    const tokenBudget = args?.query?.tokenBudget as number | undefined;

    let results = await this.julesClient.select(query);
    let truncated = false;
    let tokenCount = 0;

    // Lightweight responses by default for activities
    if (query.from === 'activities' && query.mode !== 'full') {
      results = (results as Activity[]).map((a) => toLightweight(a)) as any[];
    }

    if (tokenBudget && Array.isArray(results)) {
      const shaped = truncateToTokenBudget(results, tokenBudget);
      results = shaped.items;
      truncated = shaped.truncated;
      tokenCount = shaped.tokenCount;
    }

    const response = {
      results,
      _meta: tokenBudget ? { truncated, tokenCount, tokenBudget } : undefined,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jules MCP Server running on stdio');
  }

  private _listTools() {
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
              branch: {
                type: 'string',
                description: 'Target branch.',
              },
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
          name: 'jules_session_state',
          description:
            'Returns lightweight session metadata (state, URL, PR info). Use jules_session_timeline for activities.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'The session ID (numeric string)',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'jules_session_timeline',
          description:
            'Returns paginated lightweight activities for a session.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'The session ID (numeric string)',
              },
              limit: {
                type: 'number',
                description: 'Max activities to return. Default: 10',
              },
              startAfter: {
                type: 'string',
                description: 'Activity ID cursor for pagination',
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description:
                  'Sort order: desc (newest first, default) or asc (oldest first)',
              },
              type: {
                type: 'string',
                description:
                  'Filter by activity type: agentMessaged, userMessaged, planGenerated, planApproved, progressUpdated, sessionCompleted, sessionFailed',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'jules_get_session_status',
          description:
            '(DEPRECATED: Use jules_session_state and jules_session_timeline instead) Retrieves the current state, URL, and latest activities of a session.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'The session ID (numeric string)',
              },
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
          name: 'jules_list_sessions',
          description: 'Lists recent Jules sessions.',
          inputSchema: {
            type: 'object',
            properties: {
              pageSize: { type: 'number' },
            },
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
          name: 'jules_select',
          description:
            "Query the LOCAL CACHE of sessions and activities. Results are limited to previously synced data. Use jules_session_timeline for fresh activity data from the API. Best for searching across multiple sessions or filtering by type/state.",
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
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return.',
                  },
                  offset: {
                    type: 'number',
                    description: 'Number of results to skip.',
                  },
                  include: {
                    type: 'object',
                    description: 'Related data to include.',
                  },
                  tokenBudget: {
                    type: 'number',
                    description:
                      'Maximum tokens for response. Results truncated to fit.',
                  },
                },
                required: ['from'],
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'jules_get_session_analysis_context',
          description:
            'Returns full analysis context of a session including guidelines, timeline, and activity counts.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'The session ID to analyze',
              },
            },
            required: ['sessionId'],
          },
        },
      ],
    };
  }

  private async handleSessionState(args: any) {
    const sessionId = args.sessionId as string;
    if (!sessionId) throw new Error('sessionId is required');
    const client = this.julesClient.session(sessionId);
    const info = await client.info();
    const pr = info.outputs?.find((o) => o.type === 'pullRequest')?.pullRequest;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              id: info.id,
              state: info.state,
              url: info.url,
              title: info.title,
              ...(pr && { pr: { url: pr.url, title: pr.title } }),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleSessionTimeline(args: any) {
    const sessionId = args.sessionId as string;
    if (!sessionId) throw new Error('sessionId is required');
    const limit = (args.limit as number) || 10;
    const order = (args.order as 'asc' | 'desc') || 'desc';
    const startAfter = args.startAfter as string | undefined;
    const typeFilter = args.type as string | undefined;
    const client = this.julesClient.session(sessionId);
    // Use activities.select() for efficient querying
    const activities = await client.activities.select({
      order,
      after: startAfter,
      limit: limit + 1, // Fetch one extra to determine hasMore
      type: typeFilter,
    });
    const hasMore = activities.length > limit;
    const results = activities.slice(0, limit);
    const lightweight = results.map((a) => toLightweight(a));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              activities: lightweight,
              hasMore,
              ...(hasMore &&
                results.length > 0 && {
                  nextCursor: results[results.length - 1].id,
                }),
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
