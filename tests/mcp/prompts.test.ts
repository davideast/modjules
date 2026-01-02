import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('fs/promises');

describe('JulesMCPServer Prompts', () => {
  let mockJulesClient: any;
  let mockServerInstance: any;
  let server: JulesMCPServer;
  let listPromptsHandler: Function;
  let getPromptHandler: Function;

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

    listPromptsHandler = listCalls ? listCalls[1] : undefined;
    getPromptHandler = getCalls ? getCalls[1] : undefined;
  });

  describe('Initialization', () => {
    it('should register prompt handlers', () => {
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
        ListPromptsRequestSchema,
        expect.any(Function),
      );
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
        GetPromptRequestSchema,
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

      // Mock filesystem for template reading
      (fs.readFile as any).mockResolvedValue(
        'TEMPLATE: {INSERT_SNAPSHOT_JSON_HERE}',
      );

      const result = await getPromptHandler({
        params: {
          name: 'analyze_session',
          arguments: { sessionId: 'sess-123' },
        },
      });

      // Verify client usage
      expect(mockJulesClient.session).toHaveBeenCalledWith('sess-123');

      // Verify template reading
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('context/session-analysis.md'),
        'utf-8',
      );

      // Verify output
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');

      const content = result.messages[0].content.text;
      expect(content).toContain('TEMPLATE:');
      expect(content).toContain('"id": "sess-123"'); // JSON injected
      expect(content).toContain('"state": "COMPLETED"');
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

    it('should throw error for unknown prompt', async () => {
      await expect(
        getPromptHandler({
          params: {
            name: 'unknown_prompt',
            arguments: {},
          },
        }),
      ).rejects.toThrow('Prompt not found');
    });

    it('should handle template read failure', async () => {
      mockJulesClient.session.mockReturnValue({
        snapshot: vi.fn().mockResolvedValue({ toJSON: () => ({}) }),
      });
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));

      await expect(
        getPromptHandler({
          params: {
            name: 'analyze_session',
            arguments: { sessionId: '123' },
          },
        }),
      ).rejects.toThrow('Failed to read prompt template');
    });
  });
});
