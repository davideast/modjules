// src/session.ts
import { ApiClient } from './api.js';
import { InternalConfig } from './client.js';
import { InvalidStateError, JulesError } from './errors.js';
import { mapSessionResourceToOutcome } from './mappers.js';
import { pollSession, pollUntilCompletion } from './polling.js';
import { streamActivities } from './streaming.js';
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

  constructor(
    sessionId: string,
    apiClient: ApiClient,
    config: InternalConfig,
  ) {
    this.id = sessionId;
    this.apiClient = apiClient;
    this.config = config;
  }

  stream(): AsyncIterable<Activity> {
    return streamActivities(
      this.id,
      this.apiClient,
      this.config.pollingIntervalMs,
    );
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

    for await (const activity of this.stream()) {
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
      session => {
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
