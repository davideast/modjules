import type {
  JulesClient,
  JulesQuery,
  JulesDomain,
  SessionConfig,
  Activity,
  SyncDepth,
} from 'modjules';
import {
  getAllSchemas,
  generateMarkdownDocs,
  validateQuery,
  formatValidationResult,
} from 'modjules';
import { truncateToTokenBudget } from './tokenizer.js';
import { toLightweight } from './lightweight.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface JulesTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (client: JulesClient, args: any) => Promise<any>;
}

export async function getAnalysisContent(
  client: JulesClient,
  sessionId: string,
): Promise<string> {
  const session = client.session(sessionId);
  const snapshot = await session.snapshot();

  // Read template from context/session-analysis.md
  // Resolve path relative to this file: src/tools.ts -> ../context/session-analysis.md
  const templatePath = path.resolve(
    __dirname,
    '../context/session-analysis.md',
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

// Helper for extracting file diff
function extractFileDiff(unidiffPatch: string, filePath: string): string {
  if (!unidiffPatch) {
    return '';
  }
  // Add a leading newline to handle the first entry correctly
  const patches = ('\n' + unidiffPatch).split('\ndiff --git ');
  const targetHeader = `a/${filePath} `;
  const patch = patches.find((p) => p.startsWith(targetHeader));

  return patch ? `diff --git ${patch}`.trim() : '';
}

function computeNetChangeType(
  first: 'created' | 'modified' | 'deleted',
  latest: 'created' | 'modified' | 'deleted',
): ('created' | 'modified' | 'deleted') | null {
  if (first === 'created' && latest === 'deleted') return null; // Omit
  if (first === 'created') return 'created'; // created -> modified = created
  return latest; // modified -> deleted = deleted, modified -> modified = modified
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
    handler: async (client, args) => {
      const config: SessionConfig = {
        prompt: args.prompt,
        source: { github: args.repo, branch: args.branch },
        requireApproval: args.interactive,
        autoPr: args.autoPr !== undefined ? args.autoPr : true,
      };

      const result = args.interactive
        ? await client.session(config)
        : await client.run(config);

      return {
        content: [{ type: 'text', text: `Session created. ID: ${result.id}` }],
      };
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
    handler: async (client, args) => {
      const sessionId = args.sessionId as string;
      if (!sessionId) throw new Error('sessionId is required');
      const session = client.session(sessionId);
      const info = await session.info();
      const pr = info.outputs?.find(
        (o) => o.type === 'pullRequest',
      )?.pullRequest;
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
      const sessionId = args?.sessionId as string;
      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      const session = client.session(sessionId);
      await session.activities.hydrate();

      const activities = await session.activities.select({
        order: 'asc',
      });

      const outputs: Array<{
        command: string;
        stdout: string;
        stderr: string;
        exitCode: number | null;
        activityId: string;
      }> = [];

      const summary = {
        totalCommands: 0,
        succeeded: 0,
        failed: 0,
      };

      for (const activity of activities) {
        for (const artifact of activity.artifacts) {
          if (artifact.type === 'bashOutput') {
            outputs.push({
              command: artifact.command,
              stdout: artifact.stdout,
              stderr: artifact.stderr,
              exitCode: artifact.exitCode,
              activityId: activity.id,
            });
            summary.totalCommands++;
            if (artifact.exitCode === 0) summary.succeeded++;
            else summary.failed++;
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sessionId, outputs, summary }, null, 2),
          },
        ],
      };
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
      const sessionId = args.sessionId as string;
      if (!sessionId) throw new Error('sessionId is required');
      const limit = (args.limit as number) || 10;
      const order = (args.order as 'asc' | 'desc') || 'desc';
      const startAfter = args.startAfter as string | undefined;
      const typeFilter = args.type as string | undefined;
      const session = client.session(sessionId);
      // Hydrate cache from API before querying
      await session.activities.hydrate();
      const activities = await session.activities.select({
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
      const cursor = client.sessions({
        pageSize: args?.pageSize || 10,
      });
      const sessions = await cursor; // Gets first page
      return {
        content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
      };
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
      const { sessionId, action, message } = args;
      if (!sessionId) throw new Error('sessionId is required');

      const session = client.session(sessionId as string);

      if (action === 'approve') {
        await session.approve();
        return { content: [{ type: 'text', text: 'Plan approved.' }] };
      }

      if (action === 'send') {
        if (!message) throw new Error("Message is required for 'send' action");
        await session.send(message);
        return { content: [{ type: 'text', text: 'Message sent.' }] };
      }

      if (action === 'ask') {
        if (!message) throw new Error("Message is required for 'ask' action");
        const reply = await session.ask(message);
        return {
          content: [{ type: 'text', text: `Agent reply: ${reply.message}` }],
        };
      }

      throw new Error(`Invalid action: ${action}`);
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
      if (!query) {
        throw new Error('Query argument is required');
      }
      const tokenBudget = args?.query?.tokenBudget as number | undefined;

      let results = await client.select(query);
      let truncated = false;
      let tokenCount = 0;

      // Lightweight responses by default for activities, UNLESS user explicitly
      // selected artifact fields - in that case, respect their projection
      if (query.from === 'activities') {
        const select = query.select as string[] | undefined;
        const selectsArtifactFields =
          select?.some(
            (field) =>
              field === 'artifacts' ||
              field.startsWith('artifacts.') ||
              field === '*',
          ) ?? false;

        if (!selectsArtifactFields) {
          results = (results as Activity[]).map((a) =>
            toLightweight(a),
          ) as any[];
        }
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
      const sessionId = args?.sessionId as string;
      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      const content = await getAnalysisContent(client, sessionId);

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
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
      const sessionId = args?.sessionId as string | undefined;
      const depth = (args?.depth as SyncDepth) || 'metadata';

      const stats = await client.sync({
        sessionId,
        depth,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
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
      const domain = (args?.domain as string) || 'all';
      const format = (args?.format as string) || 'json';

      if (format === 'markdown') {
        return {
          content: [
            {
              type: 'text',
              text: generateMarkdownDocs(),
            },
          ],
        };
      }

      // JSON format
      const schemas = getAllSchemas();
      let result: unknown;

      if (domain === 'sessions') {
        result = {
          sessions: schemas.sessions,
          filterOps: schemas.filterOps,
          projection: schemas.projection,
        };
      } else if (domain === 'activities') {
        result = {
          activities: schemas.activities,
          filterOps: schemas.filterOps,
          projection: schemas.projection,
        };
      } else {
        result = schemas;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
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
      const topic = (args?.topic as string) || 'examples';
      let helpContent = '';

      switch (topic) {
        case 'where':
          helpContent = `## WHERE Clause

**Rules:**
1. Multiple conditions are ANDed together
2. Array paths use existential matching (ANY element matches)
3. Use dot notation for nested fields (e.g., "artifacts.type")
4. Cannot filter on computed fields (artifactCount, summary, durationMs)

**Examples:**
\`\`\`json
{ "from": "activities", "where": { "type": "agentMessaged" } }
{ "from": "activities", "where": { "artifacts.type": "bashOutput" } }
{ "from": "sessions", "where": { "state": { "in": ["running", "waiting"] } } }
\`\`\`

**Avoid:**
- Filtering on computed fields (use select instead)
- OR logic (not supported - use multiple queries)
- Deeply nested paths without checking schema`;
          break;

        case 'select':
          helpContent = `## SELECT Projection

**Rules:**
1. Omit select for default projection (recommended)
2. Use ["*"] to get all fields including computed
3. Prefix with "-" to exclude fields (e.g., ["-artifacts"])
4. Computed fields: artifactCount, summary, durationMs

**Examples:**
\`\`\`json
{ "from": "sessions" }
{ "from": "sessions", "select": ["id", "title", "state"] }
{ "from": "activities", "select": ["*", "-artifacts"] }
{ "from": "activities", "select": ["id", "type", "artifactCount"] }
\`\`\`

**Avoid:**
- Selecting non-existent fields (causes warnings)
- Over-fetching with ["*"] when only a few fields needed`;
          break;

        case 'operators':
          helpContent = `## Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| eq | Equals (default) | { "state": "completed" } or { "state": { "eq": "completed" } } |
| neq | Not equals | { "state": { "neq": "failed" } } |
| contains | Case-insensitive substring | { "title": { "contains": "auth" } } |
| gt, gte | Greater than (or equal) | { "createTime": { "gt": "2024-01-01" } } |
| lt, lte | Less than (or equal) | { "limit": { "lte": 100 } } |
| in | Value in array | { "type": { "in": ["agentMessaged", "userMessaged"] } } |
| exists | Field exists/is non-null | { "pr": { "exists": true } } |

**Type Requirements:**
- eq/neq/gt/lt/gte/lte: primitive (string, number, boolean, null)
- contains: string only
- in: array of values
- exists: boolean only`;
          break;

        case 'examples':
          helpContent = `## Common Query Patterns

**Find recent sessions:**
\`\`\`json
{ "from": "sessions", "limit": 10, "order": "desc" }
\`\`\`

**Find failed sessions:**
\`\`\`json
{ "from": "sessions", "where": { "state": "failed" } }
\`\`\`

**Find activities with bash output:**
\`\`\`json
{ "from": "activities", "where": { "artifacts.type": "bashOutput" } }
\`\`\`

**Search sessions by title:**
\`\`\`json
{ "from": "sessions", "where": { "search": "authentication" } }
\`\`\`

**Get session with activities:**
\`\`\`json
{
  "from": "sessions",
  "where": { "id": "12345" },
  "include": { "activities": { "limit": 20 } }
}
\`\`\`

**Paginate with cursor:**
\`\`\`json
{ "from": "activities", "limit": 10, "startAfter": "last-id-here" }
\`\`\``;
          break;

        case 'errors':
          helpContent = `## Common Mistakes

**1. Invalid domain**
\`\`\`json
// Wrong
{ "from": "session" }
// Correct
{ "from": "sessions" }
\`\`\`

**2. Filtering on computed fields**
\`\`\`json
// Wrong - artifactCount is computed
{ "from": "activities", "where": { "artifactCount": { "gt": 0 } } }
// Correct - use select instead
{ "from": "activities", "select": ["id", "artifactCount"] }
\`\`\`

**3. Invalid operator for type**
\`\`\`json
// Wrong - contains requires string
{ "where": { "state": { "contains": 123 } } }
// Correct
{ "where": { "state": { "contains": "run" } } }
\`\`\`

**4. Missing from field**
\`\`\`json
// Wrong
{ "where": { "state": "completed" } }
// Correct
{ "from": "sessions", "where": { "state": "completed" } }
\`\`\`

**5. Using OR logic (not supported)**
\`\`\`json
// Wrong - no OR support
{ "where": { "$or": [{ "state": "a" }, { "state": "b" }] } }
// Correct - use "in" operator
{ "where": { "state": { "in": ["a", "b"] } } }
\`\`\``;
          break;

        default:
          helpContent = `## Query Help

Use topic parameter for specific help:
- "where" - Filtering with WHERE clause
- "select" - Projection and field selection
- "operators" - Available filter operators
- "examples" - Common query patterns
- "errors" - Common mistakes to avoid

Quick start:
\`\`\`json
{ "from": "sessions", "limit": 10 }
\`\`\``;
      }

      return {
        content: [
          {
            type: 'text',
            text: helpContent,
          },
        ],
      };
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
      const query = args?.query;
      if (!query) {
        throw new Error('query is required');
      }

      const result = validateQuery(query);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                valid: result.valid,
                errors: result.errors,
                warnings: result.warnings,
                message: formatValidationResult(result),
              },
              null,
              2,
            ),
          },
        ],
      };
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
      const sessionId = args?.sessionId as string;
      const activityId = args?.activityId as string;
      const filePath = args?.filePath as string | undefined;

      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      if (!activityId) {
        throw new Error('activityId is required');
      }

      const session = client.session(sessionId);
      const activity = await session.activities.get(activityId).catch(() => {
        // Return undefined if get() throws (e.g., 404 Not Found)
        return undefined;
      });

      if (!activity) {
        throw new Error('Activity not found');
      }

      const changeSets = activity.artifacts.filter(
        (a) => a.type === 'changeSet',
      );

      if (changeSets.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sessionId,
                  activityId,
                  ...(filePath && { filePath }),
                  unidiffPatch: '',
                  files: [],
                  summary: {
                    totalFiles: 0,
                    created: 0,
                    modified: 0,
                    deleted: 0,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const changeSet = changeSets[0];
      let unidiffPatch = changeSet.gitPatch.unidiffPatch || '';
      const parsed = changeSet.parsed();
      let files = parsed.files;
      let summary = parsed.summary;

      if (filePath) {
        unidiffPatch = extractFileDiff(unidiffPatch, filePath);
        files = files.filter((f) => f.path === filePath);
        summary = {
          totalFiles: files.length,
          created: files.filter((f) => f.changeType === 'created').length,
          modified: files.filter((f) => f.changeType === 'modified').length,
          deleted: files.filter((f) => f.changeType === 'deleted').length,
        };
      }

      const response = {
        sessionId,
        activityId,
        ...(filePath && { filePath }),
        unidiffPatch,
        files: files.map((f) => ({
          path: f.path,
          changeType: f.changeType,
          additions: f.additions,
          deletions: f.deletions,
        })),
        summary,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
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
      const sessionId = args?.sessionId as string;
      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      const session = client.session(sessionId);
      await session.activities.hydrate();
      const activities = await session.activities.select({ order: 'asc' });

      // Map: path -> { firstChangeType, latestChangeType, activityIds, additions, deletions }
      const fileMap = new Map<
        string,
        {
          firstChangeType: 'created' | 'modified' | 'deleted';
          latestChangeType: 'created' | 'modified' | 'deleted';
          activityIds: string[];
          additions: number;
          deletions: number;
        }
      >();

      for (const activity of activities) {
        for (const artifact of activity.artifacts) {
          if (artifact.type === 'changeSet') {
            const parsed = artifact.parsed();
            for (const file of parsed.files) {
              const existing = fileMap.get(file.path);
              if (existing) {
                // Aggregate: add activityId, sum additions/deletions, update latestChangeType
                existing.activityIds.push(activity.id);
                existing.additions += file.additions;
                existing.deletions += file.deletions;
                existing.latestChangeType = file.changeType;
              } else {
                // First time seeing this file
                fileMap.set(file.path, {
                  firstChangeType: file.changeType,
                  latestChangeType: file.changeType,
                  activityIds: [activity.id],
                  additions: file.additions,
                  deletions: file.deletions,
                });
              }
            }
          }
        }
      }

      // Compute net changeType and filter out created->deleted
      const files: Array<{
        path: string;
        changeType: 'created' | 'modified' | 'deleted';
        activityIds: string[];
        additions: number;
        deletions: number;
      }> = [];
      for (const [path, info] of fileMap.entries()) {
        const netChangeType = computeNetChangeType(
          info.firstChangeType,
          info.latestChangeType,
        );
        if (netChangeType === null) continue; // created->deleted, omit

        files.push({
          path,
          changeType: netChangeType,
          activityIds: info.activityIds,
          additions: info.additions,
          deletions: info.deletions,
        });
      }

      // Build summary
      const summary = {
        totalFiles: files.length,
        created: files.filter((f) => f.changeType === 'created').length,
        modified: files.filter((f) => f.changeType === 'modified').length,
        deleted: files.filter((f) => f.changeType === 'deleted').length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sessionId, files, summary }, null, 2),
          },
        ],
      };
    },
  },
];
