import type { JulesClient } from 'modjules';
import { getQueryHelp } from '../functions/query-help.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (_client: JulesClient, args: any) => {
    const content = getQueryHelp(args?.topic || 'examples');
    return toMcpResponse(content);
  },
});
