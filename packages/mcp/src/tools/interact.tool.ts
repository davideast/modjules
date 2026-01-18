import type { JulesClient } from 'modjules';
import { interact } from '../functions/interact.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
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
});
