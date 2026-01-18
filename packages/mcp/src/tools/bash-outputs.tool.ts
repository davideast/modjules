import type { JulesClient } from 'modjules';
import { getBashOutputs } from '../functions/bash-outputs.js';
import { defineTool, toMcpResponse } from './utils.js';

export default defineTool({
  name: 'jules_get_bash_outputs',
  description:
    'Get all bash command outputs from a Jules session. Returns commands executed, their stdout/stderr, and exit codes. Use to understand what shell commands were run.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to get bash outputs from.',
      },
    },
    required: ['sessionId'],
  },
  handler: async (client: JulesClient, args: any) => {
    const result = await getBashOutputs(client, args.sessionId);
    return toMcpResponse(result);
  },
});
