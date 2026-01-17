import type { JulesClient } from 'modjules';
import { getSessionState } from '../functions/session-state.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await getSessionState(client, args.sessionId);
    return toMcpResponse(result);
  },
});
