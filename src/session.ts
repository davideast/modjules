// src/session.ts
import { ApiClient } from './api.js';
import { JulesClientImpl } from './client.js';
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
  private julesClient: JulesClientImpl;

  constructor(
    sessionId: string,
    apiClient: ApiClient,
    julesClient: JulesClientImpl,
  ) {
    this.id = sessionId;
    this.apiClient = apiClient;
    this.julesClient = julesClient;
  }

  stream(): AsyncIterable<Activity> {
    // Directly use the streamActivities generator.
    // The polling interval is accessed from the parent JulesClient configuration.
    return streamActivities(
      this.id,
      this.apiClient,
      (this.julesClient as any).pollingInterval,
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
      // Explicitly convert to Date objects to ensure robust comparison.
      // using .getTime() is the safest way to compare time values.
      const activityTime = new Date(activity.createTime).getTime();
      const askTime = startTime.getTime();

      // Ignore activities that occurred before or at the exact same ms as the prompt.
      if (activityTime <= askTime) {
        continue;
      }

      if (activity.type === 'agentMessaged') {
        return activity;
      }
    }

    // This part is reached if the stream ends before a reply is found.
    throw new JulesError('Session ended before the agent replied.');
  }

  async result(): Promise<Outcome> {
    const finalSession = await pollUntilCompletion(
      this.id,
      this.apiClient,
      (this.julesClient as any).pollingInterval,
    );
    return mapSessionResourceToOutcome(finalSession);
  }

  async waitFor(targetState: SessionState): Promise<void> {
    await pollSession(
      this.id,
      this.apiClient,
      session => {
        // Stop if we've reached the target state OR a terminal state.
        return (
          session.state === targetState ||
          session.state === 'completed' ||
          session.state === 'failed'
        );
      },
      (this.julesClient as any).pollingInterval,
    );
  }

  async info(): Promise<SessionResource> {
    return this.apiClient.request<SessionResource>(`sessions/${this.id}`);
  }
}
