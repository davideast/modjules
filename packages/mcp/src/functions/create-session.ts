import type { JulesClient, SessionConfig } from 'modjules';
import type { CreateSessionResult, CreateSessionOptions } from './types.js';

/**
 * Create a new Jules session or automated run.
 *
 * @param client - The Jules client instance
 * @param options - Session configuration options
 * @returns The created session ID
 */
export async function createSession(
  client: JulesClient,
  options: CreateSessionOptions,
): Promise<CreateSessionResult> {
  const config: SessionConfig = {
    prompt: options.prompt,
    source: { github: options.repo, branch: options.branch },
    requireApproval: options.interactive,
    autoPr: options.autoPr !== undefined ? options.autoPr : true,
  };

  const result = options.interactive
    ? await client.session(config)
    : await client.run(config);

  return {
    id: result.id,
  };
}
