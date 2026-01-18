import type { JulesClient } from 'modjules';
import { listSessions } from '../functions/list-sessions.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
  name: 'jules_list_sessions',
  description: 'Lists recent Jules sessions.',
  inputSchema: {
    type: 'object',
    properties: {
      pageSize: { type: 'number' },
    },
  },
  handler: async (client: JulesClient, args: any) => {
    const result = await listSessions(client, {
      pageSize: args?.pageSize,
    });
    return toMcpResponse(result);
  },
});
