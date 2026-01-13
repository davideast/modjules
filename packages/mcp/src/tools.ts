import type { JulesClient, JulesQuery, JulesDomain } from 'modjules';

// Import pure functions
import { getSessionState } from './functions/session-state.js';
import { getSessionTimeline } from './functions/session-timeline.js';
import { getSessionFiles } from './functions/session-files.js';
import { getBashOutputs } from './functions/bash-outputs.js';
import { getCodeChanges } from './functions/code-changes.js';
import { listSessions } from './functions/list-sessions.js';
import { createSession } from './functions/create-session.js';
import { interact } from './functions/interact.js';
import { select } from './functions/select.js';
import { sync } from './functions/sync.js';
import { getSchema } from './functions/schema.js';
import { getQueryHelp } from './functions/query-help.js';
import { validateQuery } from './functions/validate-query.js';
import { getAnalysisContext } from './functions/analysis-context.js';
import { replaySession } from './functions/replay-session.js';

// Re-export for backward compatibility
export { getAnalysisContext };

export interface JulesTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (client: JulesClient, args: any) => Promise<any>;
}

/**
 * Wrap a result as an MCP text response.
 */
function toMcpResponse(data: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export const tools: JulesTool[] = [
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
          description:
            'GitHub repository (owner/repo). Optional for repoless sessions.',
        },
        branch: {
          type: 'string',
          description: 'Target branch. Optional for repoless sessions.',
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
      required: ['prompt'],
    },
    handler: async (client, args) => {
      const result = await createSession(client, {
        prompt: args.prompt,
        repo: args.repo,
        branch: args.branch,
        interactive: args.interactive,
        autoPr: args.autoPr,
      });
      return toMcpResponse(`Session created. ID: ${result.id}`);
    },
  },
  {
    name: 'jules_session_state',
    description: `Get the current status of a Jules session.

RETURNS: id, state, url, title, pr (if created)

STATES:
- queued/planning/inProgress: Jules is working
- awaitingPlanApproval: Jules needs approval (unless auto-approve was set)
- awaitingUserFeedback: Jules explicitly asked for input
- completed: Task finished, but Jules may still have a question (see below)
- failed: Session errored out

IMPORTANT:
- "completed" does NOT mean the session is closed. Jules may have finished work but asked a follow-up question. Always check jules_session_timeline for the latest agentMessaged.
- "awaitingPlanApproval" requires action ONLY if the session was created with interactive: true. Auto-runs skip this state.
- You can send messages to ANY session regardless of state.`,
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
    handler: async (client, args) => {
      const result = await getSessionState(client, args.sessionId);
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_get_bash_outputs',
    description:
      'Get all bash command outputs from a Jules session. Returns commands executed, their stdout/stderr, and exit codes. Use to understand what shell commands were run.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to get bash outputs from.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (client, args) => {
      const result = await getBashOutputs(client, args.sessionId);
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_session_timeline',
    description: 'Returns paginated lightweight activities for a session.',
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
    handler: async (client, args) => {
      const result = await getSessionTimeline(client, args.sessionId, {
        limit: args.limit,
        startAfter: args.startAfter,
        order: args.order,
        type: args.type,
      });
      return toMcpResponse(result);
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
    handler: async (client, args) => {
      const result = await listSessions(client, {
        pageSize: args?.pageSize,
      });
      return toMcpResponse(result);
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
          description: "'ask' waits for a reply, 'send' is fire-and-forget.",
        },
        message: {
          type: 'string',
          description: "Required for 'send' and 'ask'.",
        },
      },
      required: ['sessionId', 'action'],
    },
    handler: async (client, args) => {
      const result = await interact(
        client,
        args.sessionId,
        args.action,
        args.message,
      );
      if (result.reply) {
        return toMcpResponse(`Agent reply: ${result.reply}`);
      }
      return toMcpResponse(result.message);
    },
  },
  {
    name: 'jules_select',
    description:
      'Query the LOCAL CACHE of sessions and activities. Returns only previously synced data (fast, but may be stale). To ensure fresh data: call jules_sync first, then jules_select. Best for searching across multiple sessions or filtering by type/state.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          description: 'The JulesQuery object defining the selection criteria.',
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
    handler: async (client, args) => {
      const query = args?.query as JulesQuery<JulesDomain>;
      const tokenBudget = args?.query?.tokenBudget as number | undefined;
      const result = await select(client, query, { tokenBudget });
      return toMcpResponse(result);
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
    handler: async (client, args) => {
      const content = await getAnalysisContext(client, args.sessionId);
      return toMcpResponse(content);
    },
  },
  {
    name: 'jules_sync',
    description:
      'Fetches NEW sessions and activities from the Jules API and adds them to the local cache. Only downloads data not already cached (incremental). Call this before jules_select when fresh data is needed. Returns sync statistics including counts of new items.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Optional session ID to sync. If omitted, syncs recent sessions.',
        },
        depth: {
          type: 'string',
          enum: ['metadata', 'activities'],
          description:
            "Sync depth: 'metadata' (default) syncs session info only, 'activities' also syncs activity history.",
        },
      },
    },
    handler: async (client, args) => {
      const result = await sync(client, {
        sessionId: args?.sessionId,
        depth: args?.depth,
      });
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_schema',
    description:
      'Returns the Jules Query Language (JQL) schema for sessions and activities. Use this to understand field names, types, and available query operators before constructing queries with jules_select.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: ['sessions', 'activities', 'all'],
          description:
            "Domain to get schema for: 'sessions', 'activities', or 'all' (default).",
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description:
            "Output format: 'json' (default) for structured data, 'markdown' for human-readable docs.",
        },
      },
    },
    handler: async (_client, args) => {
      const result = getSchema(args?.domain || 'all', args?.format || 'json');
      return toMcpResponse(result.content);
    },
  },
  {
    name: 'jules_query_help',
    description:
      'LLM-optimized query documentation. Returns concise rules, copy-paste examples, and common mistakes to avoid for constructing JQL queries.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['where', 'select', 'operators', 'examples', 'errors'],
          description:
            "Topic to get help for: 'where' (filtering), 'select' (projection), 'operators' (filter ops), 'examples' (common patterns), 'errors' (common mistakes).",
        },
      },
    },
    handler: async (_client, args) => {
      const content = getQueryHelp(args?.topic || 'examples');
      return toMcpResponse(content);
    },
  },
  {
    name: 'jules_validate_query',
    description:
      'Pre-flight validation for JQL queries. Use before jules_select to check for errors. Returns validation errors with suggestions for correction.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          description: 'The JQL query object to validate.',
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
              description: 'Maximum number of results.',
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order.',
            },
          },
          required: ['from'],
        },
      },
      required: ['query'],
    },
    handler: async (_client, args) => {
      const result = validateQuery(args?.query);
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_get_code_changes',
    description:
      'Get all file changes from a Jules session with parsed diffs. Returns file paths, change types (created/modified/deleted), and line counts. Use for code review or understanding what files were modified.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to get code changes from.',
        },
        activityId: {
          type: 'string',
          description:
            'Activity ID to get changeset from. Use jules_session_files to discover activity IDs.',
        },
        filePath: {
          type: 'string',
          description: "Filter to specific file's diff",
        },
      },
      required: ['sessionId', 'activityId'],
    },
    handler: async (client, args) => {
      const result = await getCodeChanges(
        client,
        args.sessionId,
        args.activityId,
        args.filePath,
      );
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_session_files',
    description:
      'Returns all files changed in a Jules session with change types and activity IDs. ' +
      'Use jules_get_code_changes with an activityId to drill into specific file diffs. ' +
      'Response includes path, changeType (created/modified/deleted), activityIds array, additions, and deletions per file. ' +
      'When presenting to users, format as grouped ASCII tree: directory/ followed by indented files showing [A]dded/[M]odified/[D]eleted, +/-lines, and (n) activity count with aligned columns. ' +
      'Use green for additions, red for deletions, yellow/orange for modified if the output supports colors; otherwise use emoji fallback: 🟢 added, 🔴 deleted, 🟡 modified.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to get file changes from.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (client, args) => {
      const result = await getSessionFiles(client, args.sessionId);
      return toMcpResponse(result);
    },
  },
  {
    name: 'jules_replay_session',
    description:
      'Step through a Jules session one activity at a time with full artifact content. ' +
      'Returns step (command+output for bash, full diff for code), nextCursor/prevCursor for navigation, ' +
      'progress { current, total }, and context (session info on first step only). ' +
      'Use for reproducing failures locally, analyzing sessions for improvements, or AI-to-AI handoff.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to replay.',
        },
        cursor: {
          type: 'string',
          description: 'The cursor for the step to retrieve.',
        },
        filter: {
          type: 'string',
          enum: ['bash', 'code', 'message'],
          description: 'Filter step types.',
        },
      },
      required: ['sessionId'],
    },
    handler: async (client, args) => {
      const result = await replaySession(
        client,
        args.sessionId,
        args.cursor,
        args.filter,
      );
      return toMcpResponse(result);
    },
  },
];
