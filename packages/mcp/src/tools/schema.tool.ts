import type { JulesClient } from 'modjules';
import { getSchema } from '../functions/schema.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
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
  handler: async (_client: JulesClient, args: any) => {
    const result = getSchema(args?.domain || 'all', args?.format || 'json');
    return toMcpResponse(result.content);
  },
});
