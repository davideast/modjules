import type { JulesClient } from 'modjules';
import type { SessionStateResult } from './types.js';

/**
 * Get the current state of a Jules session.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to query
 * @returns Session state including id, state, url, title, and optional PR info
 */
export async function getSessionState(
  client: JulesClient,
  sessionId: string,
): Promise<SessionStateResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const session = client.session(sessionId);
  const info = await session.info();

  const pr = info.outputs?.find((o) => o.type === 'pullRequest')?.pullRequest;

  return {
    id: info.id,
    state: info.state,
    url: info.url,
    title: info.title,
    ...(pr && { pr: { url: pr.url, title: pr.title } }),
  };
}
