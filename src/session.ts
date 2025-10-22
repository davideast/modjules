// src/session.ts
import { ApiClient } from './api.js';
import { JulesClientImpl } from './client.js';
import { mapSessionResourceToOutcome } from './mappers.js';
import { pollUntilCompletion, streamActivities } from './streaming.js';
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
    throw new Error('Not Implemented');
  }

  async send(prompt: string): Promise<void> {
    throw new Error('Not Implemented');
  }

  async ask(prompt: string): Promise<ActivityAgentMessaged> {
    throw new Error('Not Implemented');
  }

  async result(): Promise<Outcome> {
    const finalSession = await pollUntilCompletion(
      this.id,
      this.apiClient,
      (this.julesClient as any).pollingInterval,
    );
    return mapSessionResourceToOutcome(finalSession);
  }

  async waitFor(state: SessionState): Promise<void> {
    throw new Error('Not Implemented');
  }

  async info(): Promise<SessionResource> {
    return this.apiClient.request<SessionResource>(`sessions/${this.id}`);
  }
}
