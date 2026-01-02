import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('JulesMCPServer', () => {
  let mockJulesClient: any;
  let mockServerInstance: any;
  let server: JulesMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServerInstance = {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
    };
    (Server as any).mockImplementation(() => mockServerInstance);

    mockJulesClient = {
      session: vi.fn(),
      run: vi.fn(),
      sessions: vi.fn(),
      select: vi.fn(),
    };

    server = new JulesMCPServer(mockJulesClient);
  });

  it('should register tool handlers on initialization', () => {
    expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      expect.any(Function),
    );
    expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(
      CallToolRequestSchema,
      expect.any(Function),
    );
  });

  describe('Tools', () => {
    let listToolsHandler: Function;
    let callToolHandler: Function;

    beforeEach(() => {
      // Extract handlers
      const listCalls = mockServerInstance.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === ListToolsRequestSchema,
      );
      const callCalls = mockServerInstance.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === CallToolRequestSchema,
      );
      listToolsHandler = listCalls[1];
      callToolHandler = callCalls[1];
    });

    it('should list all tools', async () => {
      const result = await listToolsHandler();
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('jules_create_session');
      expect(toolNames).toContain('jules_get_session_status');
      expect(toolNames).toContain('jules_interact');
      expect(toolNames).toContain('jules_list_sessions');
      expect(toolNames).toContain('jules_select');
    });

    describe('jules_create_session', () => {
      it('should create an automated run when interactive is false', async () => {
        const mockRun = { id: 'run-123' };
        mockJulesClient.run.mockResolvedValue(mockRun);

        const result = await callToolHandler({
          params: {
            name: 'jules_create_session',
            arguments: {
              prompt: 'do something',
              repo: 'owner/repo',
              branch: 'main',
              interactive: false,
            },
          },
        });

        expect(mockJulesClient.run).toHaveBeenCalledWith({
          prompt: 'do something',
          source: { github: 'owner/repo', branch: 'main' },
          requireApproval: false,
          autoPr: true, // Default
        });
        expect(result.content[0].text).toContain(
          'Session created. ID: run-123',
        );
      });

      it('should create an interactive session when interactive is true', async () => {
        const mockSession = { id: 'sess-123' };
        mockJulesClient.session.mockResolvedValue(mockSession);

        const result = await callToolHandler({
          params: {
            name: 'jules_create_session',
            arguments: {
              prompt: 'do something',
              repo: 'owner/repo',
              branch: 'main',
              interactive: true,
              autoPr: false,
            },
          },
        });

        expect(mockJulesClient.session).toHaveBeenCalledWith({
          prompt: 'do something',
          source: { github: 'owner/repo', branch: 'main' },
          requireApproval: true,
          autoPr: false,
        });
        expect(result.content[0].text).toContain(
          'Session created. ID: sess-123',
        );
      });
    });

    describe('jules_get_session_status', () => {
      it('should return session status and recent activities', async () => {
        const mockSessionClient = {
          info: vi.fn().mockResolvedValue({
            state: 'inProgress',
            url: 'http://jules/s/123',
          }),
          history: vi.fn().mockReturnValue(
            (async function* () {
              yield { id: '1', type: 'agentMessaged' };
              yield { id: '2', type: 'userMessaged' };
              yield { id: '3', type: 'agentMessaged' };
            })(),
          ),
        };
        mockJulesClient.session.mockReturnValue(mockSessionClient);

        const result = await callToolHandler({
          params: {
            name: 'jules_get_session_status',
            arguments: {
              sessionId: 'sess-123',
              activityLimit: 2,
            },
          },
        });

        expect(mockJulesClient.session).toHaveBeenCalledWith('sess-123');
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.state).toBe('inProgress');
        expect(parsed.url).toBe('http://jules/s/123');
        expect(parsed.recentActivities).toHaveLength(2);
        expect(parsed.recentActivities[0].id).toBe('2');
        expect(parsed.recentActivities[1].id).toBe('3');
      });
    });

    describe('jules_interact', () => {
      it('should handle approve action', async () => {
        const mockSessionClient = {
          approve: vi.fn().mockResolvedValue(undefined),
        };
        mockJulesClient.session.mockReturnValue(mockSessionClient);

        const result = await callToolHandler({
          params: {
            name: 'jules_interact',
            arguments: {
              sessionId: 'sess-123',
              action: 'approve',
            },
          },
        });

        expect(mockSessionClient.approve).toHaveBeenCalled();
        expect(result.content[0].text).toBe('Plan approved.');
      });

      it('should handle send action', async () => {
        const mockSessionClient = {
          send: vi.fn().mockResolvedValue(undefined),
        };
        mockJulesClient.session.mockReturnValue(mockSessionClient);

        const result = await callToolHandler({
          params: {
            name: 'jules_interact',
            arguments: {
              sessionId: 'sess-123',
              action: 'send',
              message: 'hello',
            },
          },
        });

        expect(mockSessionClient.send).toHaveBeenCalledWith('hello');
        expect(result.content[0].text).toBe('Message sent.');
      });

      it('should handle ask action', async () => {
        const mockSessionClient = {
          ask: vi.fn().mockResolvedValue({ message: 'I am doing well' }),
        };
        mockJulesClient.session.mockReturnValue(mockSessionClient);

        const result = await callToolHandler({
          params: {
            name: 'jules_interact',
            arguments: {
              sessionId: 'sess-123',
              action: 'ask',
              message: 'how are you?',
            },
          },
        });

        expect(mockSessionClient.ask).toHaveBeenCalledWith('how are you?');
        expect(result.content[0].text).toBe('Agent reply: I am doing well');
      });

      it('should return error if message is missing for send', async () => {
        const result = await callToolHandler({
          params: {
            name: 'jules_interact',
            arguments: {
              sessionId: 'sess-123',
              action: 'send',
            },
          },
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Message is required');
      });
    });

    describe('jules_list_sessions', () => {
      it('should return list of sessions', async () => {
        const mockSessions = [{ id: 's1' }, { id: 's2' }];
        mockJulesClient.sessions.mockReturnValue(Promise.resolve(mockSessions));

        const result = await callToolHandler({
          params: {
            name: 'jules_list_sessions',
            arguments: {
              pageSize: 5,
            },
          },
        });

        expect(mockJulesClient.sessions).toHaveBeenCalledWith({ pageSize: 5 });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual(mockSessions);
      });
    });

    describe('jules_select', () => {
      it('should execute select query', async () => {
        const mockResults = [{ id: 'a1' }];
        mockJulesClient.select.mockResolvedValue(mockResults);

        const result = await callToolHandler({
          params: {
            name: 'jules_select',
            arguments: {
              query: { from: 'activities' },
            },
          },
        });

        expect(mockJulesClient.select).toHaveBeenCalledWith({
          from: 'activities',
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual(mockResults);
      });
    });

    it('should return error for unknown tool', async () => {
      const result = await callToolHandler({
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool not found');
    });
  });
});
