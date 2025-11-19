// src/client.ts
import { ApiClient } from './api.js';
import { createSourceManager } from './sources.js';
import {
  JulesClient,
  JulesOptions,
  SessionConfig,
  SourceManager,
  AutomatedSession,
  SessionClient,
  Outcome,
  SessionResource,
} from './types.js';
import { SourceNotFoundError } from './errors.js';
import { streamActivities } from './streaming.js';
import { pollUntilCompletion } from './polling.js';
import { mapSessionResourceToOutcome } from './mappers.js';
import { SessionClientImpl } from './session.js';
import { pMap } from './utils.js';

/**
 * The fully resolved internal configuration for the SDK.
 * @internal
 */
export type InternalConfig = {
  pollingIntervalMs: number;
  requestTimeoutMs: number;
};

import { Platform } from './platform/types.js';
import { StorageFactory } from './types.js';

export class JulesClientImpl implements JulesClient {
  public sources: SourceManager;
  private apiClient: ApiClient;
  private config: InternalConfig;
  private options: JulesOptions;
  private storageFactory: StorageFactory;
  private platform: Platform;

  constructor(
    options: JulesOptions = {},
    defaultStorageFactory: StorageFactory,
    defaultPlatform: Platform,
  ) {
    this.options = options;
    this.storageFactory = options.storageFactory ?? defaultStorageFactory;
    this.platform = options.platform ?? defaultPlatform;
    const apiKey = options.apiKey ?? process.env.JULES_API_KEY;
    const baseUrl = options.baseUrl ?? 'https://jules.googleapis.com/v1alpha';

    // Apply defaults to the user-provided config
    this.config = {
      pollingIntervalMs: options.config?.pollingIntervalMs ?? 5000,
      requestTimeoutMs: options.config?.requestTimeoutMs ?? 30000,
    };

    this.apiClient = new ApiClient({
      apiKey,
      baseUrl,
      requestTimeoutMs: this.config.requestTimeoutMs,
    });
    this.sources = createSourceManager(this.apiClient);
  }

  with(options: JulesOptions): JulesClient {
    return new JulesClientImpl(
      {
        ...this.options,
        ...options,
        config: {
          ...this.options.config,
          ...options.config,
        },
      },
      this.storageFactory,
      this.platform,
    );
  }

  async all<T>(
    items: T[],
    mapper: (item: T) => SessionConfig | Promise<SessionConfig>,
    options?: {
      concurrency?: number;
      stopOnError?: boolean;
      delayMs?: number;
    },
  ): Promise<AutomatedSession[]> {
    return pMap(
      items,
      async (item) => {
        const config = await mapper(item);
        return this.run(config);
      },
      options,
    );
  }

  private async _prepareSessionCreation(
    config: SessionConfig,
  ): Promise<object> {
    const source = await this.sources.get({ github: config.source.github });
    if (!source) {
      throw new SourceNotFoundError(config.source.github);
    }

    return {
      prompt: config.prompt,
      title: config.title,
      sourceContext: {
        source: source.name,
        githubRepoContext: {
          startingBranch: config.source.branch,
        },
      },
    };
  }

  async run(config: SessionConfig): Promise<AutomatedSession> {
    const body = await this._prepareSessionCreation(config);
    const sessionResource = await this.apiClient.request<SessionResource>(
      'sessions',
      {
        method: 'POST',
        body: {
          ...body,
          automationMode:
            config.autoPr === false
              ? 'AUTOMATION_MODE_UNSPECIFIED'
              : 'AUTO_CREATE_PR',
          requirePlanApproval: config.requireApproval ?? false,
        },
      },
    );

    const sessionId = sessionResource.id;

    return {
      id: sessionId,
      stream: async function* (this: JulesClientImpl) {
        yield* streamActivities(
          sessionId,
          this.apiClient,
          this.config.pollingIntervalMs,
          this.platform,
        );
      }.bind(this),
      result: async () => {
        const finalSession = await pollUntilCompletion(
          sessionId,
          this.apiClient,
          this.config.pollingIntervalMs,
        );
        return mapSessionResourceToOutcome(finalSession);
      },
    };
  }

  session(config: SessionConfig): Promise<SessionClient>;
  session(sessionId: string): SessionClient;
  session(
    configOrId: SessionConfig | string,
  ): Promise<SessionClient> | SessionClient {
    if (typeof configOrId === 'string') {
      const storage = this.storageFactory(configOrId);
      return new SessionClientImpl(
        configOrId,
        this.apiClient,
        this.config,
        storage,
        this.platform,
      );
    }

    const config = configOrId;
    const sessionPromise = (async () => {
      const body = await this._prepareSessionCreation(config);
      const session = await this.apiClient.request<SessionResource>(
        'sessions',
        {
          method: 'POST',
          body: {
            ...body,
            automationMode: 'AUTOMATION_MODE_UNSPECIFIED',
            requirePlanApproval: config.requireApproval ?? true,
          },
        },
      );
      const storage = this.storageFactory(session.id);
      return new SessionClientImpl(
        session.name,
        this.apiClient,
        this.config,
        storage,
        this.platform,
      );
    })();
    return sessionPromise;
  }
}
