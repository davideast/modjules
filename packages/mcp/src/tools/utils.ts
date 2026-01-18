import type { JulesClient } from 'modjules';

export interface JulesTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (client: JulesClient, args: any) => Promise<any>;
}

export function defineTool(tool: JulesTool): JulesTool {
  return tool;
}

export function toMcpResponse(data: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}
