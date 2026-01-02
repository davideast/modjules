import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('fs/promises');

describe('JulesMCPServer', () => {
  let mockJulesClient: any;
  let mockServerInstance: any;
  let server: JulesMCPServer;
  let listPromptsHandler: Function;
  let getPromptHandler: Function;
  let callToolHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Server instance
    mockServerInstance = {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
    };
    (Server as any).mockImplementation(() => mockServerInstance);

    // Mock Jules Client
    mockJulesClient = {
      session: vi.fn(),
    };

    // Initialize Server
    server = new JulesMCPServer(mockJulesClient);

    // Extract Handlers
    const listCalls = mockServerInstance.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ListPromptsRequestSchema,
    );
    const getCalls = mockServerInstance.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === GetPromptRequestSchema,
    );
    const toolCalls = mockServerInstance.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema,
    );

    listPromptsHandler = listCalls ? listCalls[1] : undefined;
    getPromptHandler = getCalls ? getCalls[1] : undefined;
    callToolHandler = toolCalls ? toolCalls[1] : undefined;
  });

  describe('Initialization', () => {
    it('should register handlers', () => {
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
        ListPromptsRequestSchema,
        expect.any(Function),
      );
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
        GetPromptRequestSchema,
        expect.any(Function),
      );
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function),
      );
    });
  });

  describe('ListPrompts', () => {
    it('should list analyze_session prompt', async () => {
      const result = await listPromptsHandler();
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].name).toBe('analyze_session');
      expect(result.prompts[0].arguments).toEqual([
        {
          name: 'sessionId',
          description: 'The Session ID to analyze',
          required: true,
        },
      ]);
    });
  });

  describe('GetPrompt', () => {
    it('should return populated prompt for analyze_session', async () => {
      const mockSnapshot = {
        toJSON: vi.fn().mockReturnValue({ id: 'sess-123', state: 'COMPLETED' }),
      };
      mockJulesClient.session.mockReturnValue({
        snapshot: vi.fn().mockResolvedValue(mockSnapshot),
      });

      (fs.readFile as any).mockResolvedValue(
        'TEMPLATE: {INSERT_SNAPSHOT_JSON_HERE}',
      );

      const result = await getPromptHandler({
        params: {
          name: 'analyze_session',
          arguments: { sessionId: 'sess-123' },
        },
      });

      expect(mockJulesClient.session).toHaveBeenCalledWith('sess-123');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('"id": "sess-123"');
    });

    it('should throw error if sessionId missing', async () => {
      await expect(
        getPromptHandler({
          params: {
            name: 'analyze_session',
            arguments: {},
          },
        }),
      ).rejects.toThrow('sessionId is required');
    });
  });

  describe('Tools', () => {
    describe('jules_get_session_analysis_context', () => {
      it('should return markdown content', async () => {
        const mockSnapshot = {
          toJSON: vi.fn().mockReturnValue({ id: 'sess-123' }),
        };
        mockJulesClient.session.mockReturnValue({
          snapshot: vi.fn().mockResolvedValue(mockSnapshot),
        });
        (fs.readFile as any).mockResolvedValue(
          'TEMPLATE: {INSERT_SNAPSHOT_JSON_HERE}',
        );

        const result = await callToolHandler({
          params: {
            name: 'jules_get_session_analysis_context',
            arguments: { sessionId: 'sess-123' },
          },
        });

        expect(result.content[0].text).toContain('TEMPLATE:');
        expect(result.content[0].text).toContain('"id": "sess-123"');
      });

      it('should return error if sessionId missing', async () => {
        const result = await callToolHandler({
          params: {
            name: 'jules_get_session_analysis_context',
            arguments: {},
          },
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('sessionId is required');
      });
    });
  });
});
