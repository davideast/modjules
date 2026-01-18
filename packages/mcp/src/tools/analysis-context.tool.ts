import type { JulesClient } from 'modjules';
import { getAnalysisContext } from '../functions/analysis-context.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
  name: 'jules_get_session_analysis_context',
  description:
    'Returns full analysis context of a session including guidelines, timeline, and activity counts.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to analyze',
      },
    },
    required: ['sessionId'],
  },
  handler: async (client: JulesClient, args: any) => {
    const content = await getAnalysisContext(client, args.sessionId);
    return toMcpResponse(content);
  },
});
