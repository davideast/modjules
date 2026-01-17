import type { JulesClient } from 'modjules';
import { getCodeChanges } from '../functions/code-changes.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await getCodeChanges(
      client,
      args.sessionId,
      args.activityId,
      args.filePath,
    );
    return toMcpResponse(result);
  },
});
