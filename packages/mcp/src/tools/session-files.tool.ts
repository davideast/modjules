import type { JulesClient } from 'modjules';
import { getSessionFiles } from '../functions/session-files.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await getSessionFiles(client, args.sessionId);
    return toMcpResponse(result);
  },
});
