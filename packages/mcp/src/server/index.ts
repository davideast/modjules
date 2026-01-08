import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { JulesClient } from 'modjules';
import { tools, getAnalysisContent } from '../tools.js';

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
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = tools.find((t) => t.name === name);

      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      try {
        return await tool.handler(this.julesClient, args);
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

      const content = await getAnalysisContent(this.julesClient, sessionId);

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jules MCP Server running on stdio');
  }

  // Public handler methods for testing - delegate to tool handlers
  async handleSessionState(args: { sessionId: string }) {
    const tool = tools.find((t) => t.name === 'jules_session_state');
    if (!tool) throw new Error('Tool not found: jules_session_state');
    return tool.handler(this.julesClient, args);
  }

  async handleSessionTimeline(args: {
    sessionId: string;
    limit?: number;
    startAfter?: string;
    order?: 'asc' | 'desc';
    type?: string;
  }) {
    const tool = tools.find((t) => t.name === 'jules_session_timeline');
    if (!tool) throw new Error('Tool not found: jules_session_timeline');
    return tool.handler(this.julesClient, args);
  }

  async handleGetCodeChanges(args: {
    sessionId: string;
    activityId?: string;
    filePath?: string;
  }) {
    const tool = tools.find((t) => t.name === 'jules_get_code_changes');
    if (!tool) throw new Error('Tool not found: jules_get_code_changes');
    return tool.handler(this.julesClient, args);
  }

  async handleGetBashOutputs(args: { sessionId: string }) {
    const tool = tools.find((t) => t.name === 'jules_get_bash_outputs');
    if (!tool) throw new Error('Tool not found: jules_get_bash_outputs');
    return tool.handler(this.julesClient, args);
  }

  async handleSessionFiles(args: { sessionId: string }) {
    const tool = tools.find((t) => t.name === 'jules_session_files');
    if (!tool) throw new Error('Tool not found: jules_session_files');
    return tool.handler(this.julesClient, args);
  }

  async handleSelect(args: { query: unknown }) {
    const tool = tools.find((t) => t.name === 'jules_select');
    if (!tool) throw new Error('Tool not found: jules_select');
    return tool.handler(this.julesClient, args);
  }

  async handleReplaySession(args: {
    sessionId: string;
    cursor?: string;
    filter?: string;
  }) {
    const tool = tools.find((t) => t.name === 'jules_replay_session');
    if (!tool) throw new Error('Tool not found: jules_replay_session');
    return tool.handler(this.julesClient, args);
  }

  // For testing - returns list of tools
  _listTools() {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  }
}
