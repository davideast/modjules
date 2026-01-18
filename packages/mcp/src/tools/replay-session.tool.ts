import type { JulesClient } from 'modjules';
import { replaySession } from '../functions/replay-session.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await replaySession(
      client,
      args.sessionId,
      args.cursor,
      args.filter,
    );
    return toMcpResponse(result);
  },
});
