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
    let resolvePromise: (outcome: Outcome) => void;
    let rejectPromise: (reason?: any) => void;

    const promise = new Promise<Outcome>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Attach the .stream() method to the promise
    const run = promise as Run;
    run.stream = () => {
      throw new Error('Streaming is not yet implemented for jules.run()');
    };

    // Start the async operation
    (async () => {
      try {
        // 1. Source Resolution
        const source = await this.sources.get({ github: config.source.github });
        if (!source) {
          throw new SourceNotFoundError(config.source.github);
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

                resolvePromise({
                  sessionId: updatedSession.id,
                  title: updatedSession.title,
                  state: 'completed',
                  pullRequest: pullRequest,
                  outputs: updatedSession.outputs,
                });
              } else { // 'failed'
                rejectPromise(new RunFailedError());
              }
            } else {
              // Continue polling
              setTimeout(poll, POLLING_INTERVAL_MS);
            }
          } catch (error) {
            rejectPromise(error);
          }
        };

        // Start the first poll
        setTimeout(poll, POLLING_INTERVAL_MS);

      } catch (error) {
        rejectPromise(error);
      }
    })();

    return run;
  }

  session(configOrId: SessionConfig | string): Promise<SessionClient> | SessionClient {
    // Stub implementation for now
    throw new Error('The "session" method is not yet implemented.');
  }
}
