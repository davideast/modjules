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

/**
 * The fully resolved internal configuration for the SDK.
 * @internal
 */
export type InternalConfig = {
  pollingIntervalMs: number;
  requestTimeoutMs: number;
};

export class JulesClientImpl implements JulesClient {
  public sources: SourceManager;
  private apiClient: ApiClient;
  private config: InternalConfig;

  constructor(options: JulesOptions = {}) {
    const apiKey = options.apiKey ?? process.env.JULES_API_KEY;
    const baseUrl =
      options.baseUrl ?? 'https://jules.googleapis.com/v1alpha';

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

  run(config: SessionConfig): AutomatedSession {
    const sessionIdPromise = (async () => {
      const body = await this._prepareSessionCreation(config);
      const session = await this.apiClient.request<SessionResource>('sessions', {
        method: 'POST',
        body: {
          ...body,
          automationMode:
            config.autoPr === false
              ? 'AUTOMATION_MODE_UNSPECIFIED'
              : 'AUTO_CREATE_PR',
          requirePlanApproval: config.requireApproval ?? false,
        },
      });
      return session.name;
    })();

    const outcomePromise = new Promise<Outcome>(async (resolve, reject) => {
      try {
        const sessionId = await sessionIdPromise;
        const finalSession = await pollUntilCompletion(
          sessionId,
          this.apiClient,
          this.config.pollingIntervalMs,
        );
        resolve(mapSessionResourceToOutcome(finalSession));
      } catch (error) {
        reject(error);
      }
    });

    const automatedSession = outcomePromise as AutomatedSession;
    automatedSession.stream = async function* (this: JulesClientImpl) {
      try {
        const sessionId = await sessionIdPromise;
        yield* streamActivities(
          sessionId,
          this.apiClient,
          this.config.pollingIntervalMs,
        );
      } catch (error) {
        // This is necessary to propagate errors from the async generator setup
        // (e.g., if sessionIdPromise rejects). Re-throwing the original error
        // preserves the specific error type (e.g., JulesAuthenticationError).
        throw error;
      }
    }.bind(this);


    return automatedSession;
  }

  session(config: SessionConfig): Promise<SessionClient>;
  session(sessionId: string): SessionClient;
  session(
    configOrId: SessionConfig | string,
  ): Promise<SessionClient> | SessionClient {
    if (typeof configOrId === 'string') {
      return new SessionClientImpl(configOrId, this.apiClient, this.config);
    }

    const config = configOrId;
    const sessionPromise = (async () => {
      const body = await this._prepareSessionCreation(config);
      const session = await this.apiClient.request<SessionResource>('sessions', {
        method: 'POST',
        body: {
          ...body,
          automationMode: 'AUTOMATION_MODE_UNSPECIFIED',
          requirePlanApproval: config.requireApproval ?? true,
        },
      });
      return new SessionClientImpl(session.name, this.apiClient, this.config);
    })();
    return sessionPromise;
  }
}
