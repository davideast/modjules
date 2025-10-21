// src/client.ts
import { ApiClient } from './api.js';
import { createSourceManager } from './sources.js';
import {
  JulesClient,
  JulesOptions,
  SessionConfig,
  SourceManager,
  Run,
  SessionClient,
} from './types.js';

export class JulesClientImpl implements JulesClient {
  public sources: SourceManager;
  private apiClient: ApiClient;

  constructor(options: JulesOptions = {}) {
    const apiKey = options.apiKey ?? process.env.JULES_API_KEY;
    const baseUrl =
      options.baseUrl ?? 'https://jules.googleapis.com/v1alpha';

    this.apiClient = new ApiClient({ apiKey, baseUrl });
    this.sources = createSourceManager(this.apiClient);
  }

  run(config: SessionConfig): Run {
    // Stub implementation for now
    throw new Error('The "run" method is not yet implemented.');
  }

  session(configOrId: SessionConfig | string): Promise<SessionClient> | SessionClient {
    // Stub implementation for now
    throw new Error('The "session" method is not yet implemented.');
  }
}
