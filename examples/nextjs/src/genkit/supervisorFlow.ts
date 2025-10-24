import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { Jules } from 'julets';

// 1. Initialize Genkit
const ai = genkit({
plugins: [googleAI()],
});

// 2. Initialize Jules
const jules = Jules();

// 3. Define the Tool
export const delegateToJules = ai.defineTool(
{
name: 'delegateToJules',
description: 'Delegates a complex coding task to the Jules agent. Use this for refactoring, fixing bugs, or implementing new features in a repository.',
inputSchema: z.object({
prompt: z.string().describe('Detailed natural language instructions for the coding agent.'),
repo: z.string().describe('The GitHub repository in "owner/name" format.'),
branch: z.string().optional().describe('The branch to work on. Defaults to main.'),
}),
outputSchema: z.string(),
},
async (input) => {
// Execute the automated run
const outcome = await jules.run({
prompt: input.prompt,
source: { github: input.repo, branch: input.branch ?? 'main' },
autoPr: true, // Supervisor always wants a PR
});
return `Jules task finished with state: ${outcome.state}. PR: ${outcome.pullRequest?.url ?? 'None'}`;
}
);

// 4. Define the Supervisor Flow
// We use a simple prompt that enables the tool.
export const supervisorFlow = ai.defineFlow(
{
name: 'supervisorFlow',
inputSchema: z.object({
message: z.string(),
// Simple history for now: array of strings or basic objects.
// In a real app, use Genkit's Message format.
history: z.array(z.any()).optional()
}),
streamSchema: z.string(),
},
async ({ message, history }, { sendChunk }) => {
// Construct history for the model (simplest approach for demo)
// You might need to map 'history' to Genkit's expected format if it's complex.
const { stream, response } = ai.generateStream({
model: gemini15Flash,
prompt: message, // In reality, you'd prepend history here
tools: [delegateToJules],
config: { temperature: 0.7 }
});

// Stream responses back to Next.js client
for await (const chunk of stream) {
sendChunk(chunk.text);
}

return (await response).text;
}
);
