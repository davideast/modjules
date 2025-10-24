// src/polling.ts
import { ApiClient } from './api.js';
import { SessionResource } from './types.js';

// A helper function for delaying execution.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A generalized utility for polling the session resource until a specific
 * condition is met.
 *
 * @param sessionId The ID of the session to poll.
 * @param apiClient The API client for making requests.
 * @param predicateFn A function that returns `true` if polling should stop.
 * @param pollingInterval The interval in milliseconds between poll attempts.
 * @returns The session resource that satisfied the predicate.
 * @internal
 */
export async function pollSession(
  sessionId: string,
  apiClient: ApiClient,
  predicateFn: (session: SessionResource) => boolean,
  pollingInterval: number,
): Promise<SessionResource> {
  while (true) {
    const session = await apiClient.request<SessionResource>(
      `sessions/${sessionId}`,
    );

    if (predicateFn(session)) {
      return session;
    }

    await sleep(pollingInterval);
  }
}

/**
 * Polls the `GET /sessions/{id}` endpoint until the session reaches a terminal state.
 *
 * @param sessionId The ID of the session to poll.
 * @param apiClient The API client for making requests.
 * @param pollingInterval The interval in milliseconds between poll attempts.
 * @returns The final SessionResource.
 * @internal
 */
export async function pollUntilCompletion(
  sessionId: string,
  apiClient: ApiClient,
  pollingInterval: number,
): Promise<SessionResource> {
  return pollSession(
    sessionId,
    apiClient,
    session => session.state === 'completed' || session.state === 'failed',
    pollingInterval,
  );
}
