import type { JulesTool } from './utils.js';
export { type JulesTool, defineTool, toMcpResponse } from './utils.js';

// Runtime self-discovery of all *.tool.ts files
const toolModules = import.meta.glob('./*.tool.ts', { eager: true });

export const tools: JulesTool[] = Object.values(toolModules)
  .map((mod: any) => mod.default)
  .filter(Boolean);
