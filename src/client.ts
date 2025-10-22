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
  Outcome,
  SessionResource,
  PullRequest,
  Activity,
} from './types.js';
import { SourceNotFoundError, RunFailedError } from './errors.js';
import { pollUntilCompletion, streamActivities } from './streaming.js';
import { mapSessionResourceToOutcome } from './mappers.js';
import { SessionClientImpl } from './session.js';

export class JulesClientImpl implements JulesClient {
  public sources: SourceManager;
  private apiClient: ApiClient;
  private pollingInterval: number;

  constructor(options: JulesOptions = {}) {
    const apiKey = options.apiKey ?? process.env.JULES_API_KEY;
    const baseUrl =
      options.baseUrl ?? 'https://jules.googleapis.com/v1alpha';

    this.pollingInterval = options.pollingInterval ?? 5000;
    this.apiClient = new ApiClient({ apiKey, baseUrl });
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

  run(config: SessionConfig): Run {
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
      return session.id;
    })();

    const outcomePromise = new Promise<Outcome>(async (resolve, reject) => {
      try {
        const sessionId = await sessionIdPromise;
        const finalSession = await pollUntilCompletion(
          sessionId,
          this.apiClient,
          this.pollingInterval,
        );
        resolve(mapSessionResourceToOutcome(finalSession));
      } catch (error) {
        reject(error);
      }
    });

    const run = outcomePromise as Run;
    run.stream = async function* (this: JulesClientImpl) {
      try {
        const sessionId = await sessionIdPromise;
        yield* streamActivities(sessionId, this.apiClient, this.pollingInterval);
      } catch (error) {
        throw error;
      }
    }.bind(this);

    return run;
  }

  session(config: SessionConfig): Promise<SessionClient>;
  session(sessionId: string): SessionClient;
  session(
    configOrId: SessionConfig | string,
  ): Promise<SessionClient> | SessionClient {
    if (typeof configOrId === 'string') {
      return new SessionClientImpl(configOrId, this.apiClient, this);
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
      return new SessionClientImpl(session.id, this.apiClient, this);
    })();
    return sessionPromise;
  }
}
