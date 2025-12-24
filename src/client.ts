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
import { SessionCursor, ListSessionsOptions } from './sessions.js';

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

/**
 * Implementation of the main JulesClient interface.
 * This class acts as the central hub for creating and managing sessions,
 * as well as accessing other resources like sources.
 */
export class JulesClientImpl implements JulesClient {
  /**
   * Manages source connections (e.g., GitHub repositories).
   */
  public sources: SourceManager;
  private apiClient: ApiClient;
  private config: InternalConfig;
  private options: JulesOptions;
  private storageFactory: StorageFactory;
  private platform: Platform;

  /**
   * Creates a new instance of the JulesClient.
   *
   * @param options Configuration options for the client.
   * @param defaultStorageFactory Factory for creating storage instances.
   * @param defaultPlatform Platform-specific implementation.
   */
  constructor(
    options: JulesOptions = {},
    defaultStorageFactory: StorageFactory,
    defaultPlatform: Platform,
  ) {
    this.options = options;
    this.storageFactory = options.storageFactory ?? defaultStorageFactory;
    this.platform = options.platform ?? defaultPlatform;

    // 1. Resolve Proxy Configuration
    const envProxyUrl = this.getEnv('JULES_PROXY');
    const envSecret = this.getEnv('JULES_SECRET');

    // Priority: Options > Env > Default (Node Only)
    if (!options.proxy && envProxyUrl) {
      options.proxy = {
        url: envProxyUrl,
        auth: envSecret ? () => envSecret : undefined,
      };
    }

    const apiKey =
      options.apiKey_TEST_ONLY_DO_NOT_USE_IN_PRODUCTION ??
      options.apiKey ??
      this.platform.getEnv('JULES_API_KEY');
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
      proxy: options.proxy,
    });
    this.sources = createSourceManager(this.apiClient);
  }

  /**
   * Helper to resolve environment variables with support for frontend prefixes.
   */
  private getEnv(key: string): string | undefined {
    return (
      this.platform.getEnv(`NEXT_PUBLIC_${key}`) ||
      this.platform.getEnv(`REACT_APP_${key}`) ||
      this.platform.getEnv(`VITE_${key}`) ||
      this.platform.getEnv(key)
    );
  }

  /**
   * Creates a new Jules client instance with updated configuration.
   * This is an immutable operation; the original client instance remains unchanged.
   *
   * @param options The new configuration options to merge with the existing ones.
   * @returns A new JulesClient instance with the updated configuration.
   */
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

  /**
   * Connects to the Jules service with the provided configuration.
   * Acts as a factory method for creating a new client instance.
   *
   * @param options Configuration options for the client.
   * @returns A new JulesClient instance.
   */
  connect(options: JulesOptions): JulesClient {
    return new JulesClientImpl(
      {
        ...this.options,
        ...options,
      },
      this.storageFactory,
      this.platform,
    );
  }

  /**
   * Lists sessions with a fluent, pagination-friendly API.
   * @param options Configuration for pagination (pageSize, limit, pageToken)
   * @returns A SessionCursor that can be awaited (first page) or iterated (all pages).
   */
  sessions(options?: ListSessionsOptions): SessionCursor {
    return new SessionCursor(this.apiClient, options);
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

  /**
   * Executes a task in automated mode.
   * This is a high-level abstraction for "fire-and-forget" tasks.
   *
   * **Side Effects:**
   * - Creates a new session on the Jules API (`POST /sessions`).
   * - Initiates background polling for activity updates.
   * - May create a Pull Request if `autoPr` is true (default).
   *
   * **Data Transformation:**
   * - Resolves the `github` source identifier (e.g., `owner/repo`) to a full resource name.
   * - Defaults `requirePlanApproval` to `false` for automated runs.
   *
   * @param config The configuration for the run.
   * @returns A `AutomatedSession` object, which is an enhanced Promise that resolves to the final outcome.
   * @throws {SourceNotFoundError} If the specified GitHub repository cannot be found or accessed.
   * @throws {JulesApiError} If the session creation fails (e.g., 401 Unauthorized).
   *
   * @example
   * const run = await jules.run({
   *   prompt: "Fix the login bug",
   *   source: { github: "my-org/repo", branch: "main" }
   * });
   * const outcome = await run.result();
   */
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
        // ✅ PASS CONTEXT: I want to CREATE
        handshake: {
          intent: 'create',
          sessionConfig: { prompt: config.prompt, source: config.source },
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

  /**
   * Creates a new interactive session for workflows requiring human oversight.
   *
   * **Side Effects:**
   * - Creates a new session on the Jules API (`POST /sessions`).
   * - Initializes local storage for the session.
   *
   * **Data Transformation:**
   * - Defaults `requirePlanApproval` to `true` for interactive sessions.
   *
   * @param config The configuration for the session.
   * @returns A Promise resolving to the interactive `SessionClient`.
   * @throws {SourceNotFoundError} If the source cannot be found.
   *
   * @example
   * const session = await jules.session({
   *   prompt: "Let's explore the codebase",
   *   source: { github: "owner/repo", branch: "main" }
   * });
   */
  session(config: SessionConfig): Promise<SessionClient>;
  /**
   * Rehydrates an existing session from its ID, allowing you to resume interaction.
   * This is useful for stateless environments (like serverless functions) where you need to
   * reconnect to a long-running session.
   *
   * **Side Effects:**
   * - Initializes local storage for the existing session ID.
   * - Does NOT make a network request immediately (lazy initialization).
   *
   * @param sessionId The ID of the existing session.
   * @returns The interactive `SessionClient`.
   *
   * @example
   * const session = jules.session("12345");
   * const info = await session.info(); // Now makes a request
   */
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
          // ✅ PASS CONTEXT
          handshake: {
            intent: 'create',
            sessionConfig: { prompt: config.prompt, source: config.source },
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
