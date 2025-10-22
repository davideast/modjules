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
import { streamActivities } from './streaming.js';

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

  private async _createSessionAndGetId(config: SessionConfig): Promise<string> {
    const source = await this.sources.get({ github: config.source.github });
    if (!source) {
      throw new SourceNotFoundError(config.source.github);
    }

    const session = await this.apiClient.request<SessionResource>('sessions', {
      method: 'POST',
      body: {
        prompt: config.prompt,
        title: config.title,
        sourceContext: {
          source: source.name,
          githubRepoContext: {
            startingBranch: config.source.branch,
          },
        },
        automationMode: (config.autoPr === false) ? 'AUTOMATION_MODE_UNSPECIFIED' : 'AUTO_CREATE_PR',
        requirePlanApproval: config.requireApproval ?? false,
      }
    });

    return session.id;
  }

  run(config: SessionConfig): Run {
    const sessionIdPromise = this._createSessionAndGetId(config);

    const outcomePromise = new Promise<Outcome>(async (resolve, reject) => {
      try {
        const sessionId = await sessionIdPromise;

        let finalActivity: Activity | undefined;
        for await (const activity of streamActivities(sessionId, this.apiClient, this.pollingInterval)) {
          if (activity.type === 'sessionCompleted' || activity.type === 'sessionFailed') {
            finalActivity = activity;
            break;
          }
        }

        if (!finalActivity) {
          throw new RunFailedError('Stream ended without a terminal activity.');
        }

        const updatedSession = await this.apiClient.request<SessionResource>(`sessions/${sessionId}`);

        if (updatedSession.state === 'completed') {
          const prOutput = updatedSession.outputs.find(o => 'pullRequest' in o);
          const pullRequest = prOutput ? (prOutput as { pullRequest: PullRequest }).pullRequest : undefined;

          resolve({
            sessionId: updatedSession.id,
            title: updatedSession.title,
            state: 'completed',
            pullRequest,
            outputs: updatedSession.outputs,
          });
        } else {
          const reason = (finalActivity as any)?.reason || 'Run failed';
          reject(new RunFailedError(reason));
        }
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
  session(configOrId: SessionConfig | string): Promise<SessionClient> | SessionClient {
    // This is the core implementation that handles both overloads.
    if (typeof configOrId === 'string') {
      // Logic for session(sessionId: string): SessionClient
      throw new Error('Hydrating a session by ID is not yet implemented.');
    } else {
      // Logic for session(config: SessionConfig): Promise<SessionClient>
      throw new Error('Creating a new interactive session is not yet implemented.');
    }
  }
}
