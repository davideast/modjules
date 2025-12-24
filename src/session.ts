// src/session.ts
import { DefaultActivityClient } from './activities/client.js';
import { ActivityClient, SelectOptions } from './activities/types.js';
import { ApiClient, ApiRequestOptions } from './api.js';
import { InternalConfig } from './client.js';
import { InvalidStateError, JulesError } from './errors.js';
import { mapSessionResourceToOutcome } from './mappers.js';
import { NetworkAdapter } from './network/adapter.js';
import { pollSession, pollUntilCompletion } from './polling.js';
import { MemoryStorage } from './storage/memory.js';
import { NodeFileStorage } from './storage/node-fs.js';
import { ActivityStorage } from './storage/types.js';
import { StreamActivitiesOptions } from './streaming.js';
import {
  Activity,
  ActivityAgentMessaged,
  Outcome,
  SessionClient,
  SessionResource,
  SessionState,
} from './types.js';

/**
 * Implementation of the SessionClient interface.
 * Manages an interactive session with the Jules agent.
 */
export class SessionClientImpl implements SessionClient {
  readonly id: string;
  private apiClient: ApiClient;
  private config: InternalConfig;

  // The new client instance
  private _activities: ActivityClient;

  /**
   * Creates a new instance of SessionClientImpl.
   *
   * @param sessionId The ID of the session.
   * @param apiClient The API client to use for network requests.
   * @param config The configuration options.
   * @param storage The storage engine for activities.
   * @param platform The platform adapter.
   */
  constructor(
    sessionId: string,
    apiClient: ApiClient,
    config: InternalConfig,
    storage: ActivityStorage,
    platform: any,
  ) {
    this.id = sessionId.replace(/^sessions\//, '');
    this.apiClient = apiClient;
    this.config = config;

    // --- WIRING THE NEW ENGINE ---
    const network = new NetworkAdapter(
      this.apiClient,
      this.id,
      this.config.pollingIntervalMs,
      platform,
    );

    this._activities = new DefaultActivityClient(storage, network);
  }

  // Private helper wrapper to enforce resume context
  private async request<T>(path: string, options: ApiRequestOptions = {}) {
    return this.apiClient.request<T>(path, {
      ...options,
      // Always attach 'resume' context for this session instance
      handshake: { intent: 'resume', sessionId: this.id },
    });
  }

  /**
   * COLD STREAM: Yields all known past activities from local storage.
   */
  history(): AsyncIterable<Activity> {
    return this._activities.history();
  }

  /**
   * HOT STREAM: Yields ONLY future activities as they arrive from the network.
   */
  updates(): AsyncIterable<Activity> {
    return this._activities.updates();
  }

  /**
   * LOCAL QUERY: Performs rich filtering against local storage only.
   */
  select(options?: SelectOptions): Promise<Activity[]> {
    return this._activities.select(options);
  }

  /**
   * Provides a real-time stream of activities for the session.
   *
   * @param options Options to control the stream.
   */
  async *stream(
    options: StreamActivitiesOptions = {},
  ): AsyncIterable<Activity> {
    // Proxy to the new engine, preserving legacy filtering options.
    // The base .stream() does not yet support filtering, so we do it here.
    for await (const activity of this._activities.stream()) {
      if (
        options.exclude?.originator &&
        activity.originator === options.exclude.originator
      ) {
        continue;
      }
      yield activity;
    }
  }

  /**
   * Approves the currently pending plan.
   * Only valid if the session state is `awaitingPlanApproval`.
   *
   * **Side Effects:**
   * - Sends a POST request to `sessions/{id}:approvePlan`.
   * - Transitions the session state from `awaitingPlanApproval` to `inProgress` (eventually).
   *
   * @throws {InvalidStateError} If the session is not in the `awaitingPlanApproval` state.
   *
   * @example
   * await session.waitFor('awaitingPlanApproval');
   * await session.approve();
   */
  async approve(): Promise<void> {
    const currentState = (await this.info()).state;
    if (currentState !== 'awaitingPlanApproval') {
      throw new InvalidStateError(
        `Cannot approve plan because the session is not awaiting approval. Current state: ${currentState}`,
      );
    }
    await this.request(`sessions/${this.id}:approvePlan`, {
      method: 'POST',
      body: {},
    });
  }

  /**
   * Sends a message (prompt) to the agent in the context of the current session.
   * This is a fire-and-forget operation. To see the response, use `stream()` or `ask()`.
   *
   * **Side Effects:**
   * - Sends a POST request to `sessions/{id}:sendMessage`.
   * - Appends a new `userMessaged` activity to the session history.
   *
   * @param prompt The message to send.
   *
   * @example
   * await session.send("Please clarify step 2.");
   */
  async send(prompt: string): Promise<void> {
    await this.request(`sessions/${this.id}:sendMessage`, {
      method: 'POST',
      body: { prompt },
    });
  }

  /**
   * Sends a message to the agent and waits specifically for the agent's immediate reply.
   * This provides a convenient request/response flow for conversational interactions.
   *
   * **Behavior:**
   * - Sends the prompt using `send()`.
   * - Subscribes to the activity stream.
   * - Resolves with the first `agentMessaged` activity that appears *after* the prompt was sent.
   *
   * @param prompt The message to send.
   * @returns The agent's reply activity.
   * @throws {JulesError} If the session terminates before the agent replies.
   *
   * @example
   * const reply = await session.ask("What is the status?");
   * console.log(reply.message);
   */
  async ask(prompt: string): Promise<ActivityAgentMessaged> {
    const startTime = new Date();
    await this.send(prompt);

    // Don't return our own message.
    for await (const activity of this.stream({
      exclude: { originator: 'user' },
    })) {
      const activityTime = new Date(activity.createTime).getTime();
      const askTime = startTime.getTime();

      if (activityTime <= askTime) {
        continue;
      }

      if (activity.type === 'agentMessaged') {
        return activity;
      }
    }

    throw new JulesError('Session ended before the agent replied.');
  }

  /**
   * Waits for the session to reach a terminal state and returns the result.
   *
   * **Behavior:**
   * - Polls the session API until state is 'completed' or 'failed'.
   * - Maps the final session resource to a friendly `Outcome` object.
   *
   * @returns The final outcome of the session.
   * @throws {AutomatedSessionFailedError} If the session ends in a 'failed' state.
   */
  async result(): Promise<Outcome> {
    const finalSession = await pollUntilCompletion(
      this.id,
      this.apiClient,
      this.config.pollingIntervalMs,
    );
    return mapSessionResourceToOutcome(finalSession);
  }

  /**
   * Pauses execution and waits until the session reaches a specific state.
   * Also returns if the session reaches a terminal state ('completed' or 'failed')
   * to prevent infinite waiting.
   *
   * **Behavior:**
   * - Polls the session API at the configured interval.
   * - Resolves immediately if the session is already in the target state (or terminal).
   *
   * @param targetState The target state to wait for.
   *
   * @example
   * await session.waitFor('awaitingPlanApproval');
   */
  async waitFor(targetState: SessionState): Promise<void> {
    await pollSession(
      this.id,
      this.apiClient,
      (session) => {
        return (
          session.state === targetState ||
          session.state === 'completed' ||
          session.state === 'failed'
        );
      },
      this.config.pollingIntervalMs,
    );
  }

  /**
   * Retrieves the latest state of the underlying session resource from the API.
   */
  async info(): Promise<SessionResource> {
    return this.request<SessionResource>(`sessions/${this.id}`);
  }
}
