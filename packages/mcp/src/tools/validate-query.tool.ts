import type { JulesClient } from 'modjules';
import { validateQuery } from '../functions/validate-query.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
  name: 'jules_validate_query',
  description:
    'Pre-flight validation for JQL queries. Use before jules_select to check for errors. Returns validation errors with suggestions for correction.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'object',
        description: 'The JQL query object to validate.',
        properties: {
          from: {
            type: 'string',
            enum: ['sessions', 'activities'],
            description: 'The domain to query from.',
          },
          select: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to project.',
          },
          where: {
            type: 'object',
            description: 'Filter criteria.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results.',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order.',
          },
        },
        required: ['from'],
      },
    },
    required: ['query'],
  },
  handler: async (_client: JulesClient, args: any) => {
    const result = validateQuery(args?.query);
    return toMcpResponse(result);
  },
});
