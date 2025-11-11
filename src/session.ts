// src/session.ts
import { DefaultActivityClient } from './activities/client.js';
import { ActivityClient } from './activities/types.js';
import { ApiClient } from './api.js';
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

export class SessionClientImpl implements SessionClient {
  readonly id: string;
  private apiClient: ApiClient;
  private config: InternalConfig;

  // The new client instance
  private _activities: ActivityClient;

  constructor(
    sessionId: string,
    apiClient: ApiClient,
    config: InternalConfig,
    storage: ActivityStorage,
  ) {
    this.id = sessionId.replace(/^sessions\//, '');
    this.apiClient = apiClient;
    this.config = config;

    // --- WIRING THE NEW ENGINE ---
    const network = new NetworkAdapter(
      this.apiClient,
      this.id,
      this.config.pollingIntervalMs,
    );

    this._activities = new DefaultActivityClient(storage, network);
  }

  activities(): ActivityClient {
    return this._activities;
  }

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

  async approve(): Promise<void> {
    const currentState = (await this.info()).state;
    if (currentState !== 'awaitingPlanApproval') {
      throw new InvalidStateError(
        `Cannot approve plan because the session is not awaiting approval. Current state: ${currentState}`,
      );
    }
    await this.apiClient.request(`sessions/${this.id}:approvePlan`, {
      method: 'POST',
      body: {},
    });
  }

  async send(prompt: string): Promise<void> {
    await this.apiClient.request(`sessions/${this.id}:sendMessage`, {
      method: 'POST',
      body: { prompt },
    });
  }

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

  async result(): Promise<Outcome> {
    const finalSession = await pollUntilCompletion(
      this.id,
      this.apiClient,
      this.config.pollingIntervalMs,
    );
    return mapSessionResourceToOutcome(finalSession);
  }

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

  async info(): Promise<SessionResource> {
    return this.apiClient.request<SessionResource>(`sessions/${this.id}`);
  }
}
