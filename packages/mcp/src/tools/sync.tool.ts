import type { JulesClient } from 'modjules';
import { sync } from '../functions/sync.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (client: JulesClient, args: any) => {
    const result = await sync(client, {
      sessionId: args?.sessionId,
      depth: args?.depth,
    });
    return toMcpResponse(result);
  },
});
