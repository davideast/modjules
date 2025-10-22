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
} from './types.js';
import { SourceNotFoundError, RunFailedError } from './errors.js';

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
    const promise = new Promise<Outcome>(async (resolve, reject) => {
      try {
        // 1. Source Resolution
        const source = await this.sources.get({ github: config.source.github });
        if (!source) {
          // Explicitly reject and stop execution if source not found
          return reject(new SourceNotFoundError(config.source.github));
        }

        // 2. Session Creation
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

        // 3. Polling
        const POLLING_INTERVAL_MS = 5000;
        const poll = async () => {
          try {
            const updatedSession = await this.apiClient.request<SessionResource>(`sessions/${session.id}`);

            if (updatedSession.state === 'completed' || updatedSession.state === 'failed') {
              // Terminal state reached, stop polling
              if (updatedSession.state === 'completed') {
                // Find the output that has a 'pullRequest' key.
                const prOutput = updatedSession.outputs.find(o => 'pullRequest' in o);
                const pullRequest = prOutput ? (prOutput as { pullRequest: PullRequest }).pullRequest : undefined;

                resolve({
                  sessionId: updatedSession.id,
                  title: updatedSession.title,
                  state: 'completed',
                  pullRequest: pullRequest,
                  outputs: updatedSession.outputs,
                });
              } else { // 'failed'
                reject(new RunFailedError());
              }
            } else {
              // Continue polling
              setTimeout(poll, POLLING_INTERVAL_MS);
            }
          } catch (error) {
            reject(error);
          }
        };

        // Start the first poll
        setTimeout(poll, POLLING_INTERVAL_MS);

      } catch (error) {
        reject(error);
      }
    });

    // Attach the .stream() method to the promise
    const run = promise as Run;
    run.stream = () => {
      throw new Error('Streaming is not yet implemented for jules.run()');
    };

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
