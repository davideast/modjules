import type { JulesClient } from 'modjules';
import { getSessionTimeline } from '../functions/session-timeline.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await getSessionTimeline(client, args.sessionId, {
      limit: args.limit,
      startAfter: args.startAfter,
      order: args.order,
      type: args.type,
    });
    return toMcpResponse(result);
  },
});
