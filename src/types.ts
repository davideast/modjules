
//
// Jules TypeScript SDK Types
//
// This file defines the public interfaces and types for the Jules SDK,
// adhering to modern TypeScript conventions (camelCase, Discriminated Unions, Async Iterators).
// Detailed comments map these types to the corresponding REST API resources and endpoints.
//

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration options for the Jules SDK client.
 *
 * @example
 * import { Jules } from 'julets';
 *
 * const jules = Jules({
 *   apiKey: 'YOUR_API_KEY',
 *   config: {
 *     requestTimeoutMs: 60000, // 1 minute
 *   }
 * });
 */
export interface JulesOptions {
  /**
   * The API key used for authentication.
   * If not provided, the SDK will attempt to read it from the JULES_API_KEY environment variable.
   * Authenticates requests via the `X-Goog-Api-Key` header.
   */
  apiKey?: string;
  /**
   * The base URL for the Jules API.
   * @default 'https://jules.googleapis.com/v1alpha'
   */
  baseUrl?: string;
  /**
   * Advanced operational parameters for the SDK.
   */
  config?: {
    /**
     * The interval in milliseconds to poll for session and activity updates.
     * @default 5000
     */
    pollingIntervalMs?: number;
    /**
     * The timeout in milliseconds for individual HTTP requests to the Jules API.
     * @default 30000
     */
    requestTimeoutMs?: number;
  };
}

/**
 * Ergonomic definition for specifying a source context when creating a session or run.
 * This simplifies the process of targeting a specific GitHub repository and branch.
 *
 * @example
 * const sourceInput: SourceInput = {
 *   github: 'my-org/my-repo',
 *   branch: 'main'
 * };
 */
export interface SourceInput {
  /**
   * The GitHub repository identifier in the format 'owner/repo'.
   * The SDK will resolve this to the full source name (e.g., 'sources/github/owner/repo').
   */
  github: string;
  /**
   * The name of the branch to start the session from.
   * Maps to `sourceContext.githubRepoContext.startingBranch` in the REST API.
   */
  branch: string;
}

/**
 * Configuration options for starting a new session or run.
 * This is the primary input for `jules.run()` and `jules.session()`.
 *
 * @example
 * const config: SessionConfig = {
 *   prompt: "Fix the login button bug.",
 *   source: { github: 'my-org/my-repo', branch: 'main' },
 *   requireApproval: false
 * };
 */
export interface SessionConfig {
  /**
   * The initial instruction or task description for the agent.
   * Required. Maps to `prompt` in the REST API `POST /sessions` payload.
   */
  prompt: string;
  /**
   * The source code context for the session.
   * Required. The SDK constructs the `sourceContext` payload from this input.
   */
  source: SourceInput;
  /**
   * Optional title for the session. If not provided, the system will generate one.
   * Maps to `title` in the REST API.
   */
  title?: string;
  /**
   * If true, the agent will pause and wait for explicit approval (via `session.approve()`)
   * before executing any generated plan.
   *
   * @default false for `jules.run()`
   * @default true for `jules.session()`
   */
  requireApproval?: boolean;
  /**
   * If true, the agent will automatically create a Pull Request when the task is completed.
   * Maps to `automationMode: AUTO_CREATE_PR` in the REST API.
   * If false, maps to `AUTOMATION_MODE_UNSPECIFIED`.
   *
   * @default true for `jules.run()`
   */
  autoPr?: boolean;
}

// =============================================================================
// Core Resource Types (REST API Mappings)
// =============================================================================

// -----------------------------------------------------------------------------
// Source Types
// -----------------------------------------------------------------------------

/**
 * Represents the details of a GitHub repository connected to Jules.
 * Maps to the `GitHubRepo` message in the REST API.
 */
export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate: boolean;
}

/**
 * An input source of data for a session (e.g., a GitHub repository).
 * This is a discriminated union based on the `type` property.
 * Maps to the `Source` resource in the REST API.
 *
 * @example
 * async (source: Source) => {
 *   if (source.type === 'githubRepo') {
 *     console.log(source.githubRepo.owner);
 *   }
 * }
 */
export type Source = {
  /**
   * The full resource name (e.g., "sources/github/owner/repo").
   */
  name: string;
  /**
   * The short identifier of the source (e.g., "github/owner/repo").
   */
  id: string;
} & (
  {
    type: 'githubRepo';
    githubRepo: GitHubRepo;
  }
);

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

/**
 * Represents the possible states of a session.
 * Maps to the `State` enum in the REST API `Session` resource.
 */
export type SessionState =
  | 'unspecified'
  | 'queued'
  | 'planning'
  /** The agent is waiting for plan approval. Call `session.approve()`. */
  | 'awaitingPlanApproval'
  | 'awaitingUserFeedback'
  | 'inProgress'
  | 'paused'
  | 'failed'
  | 'completed';

/**
 * A pull request created by the session.
 * Maps to the `PullRequest` message in the REST API.
 */
export interface PullRequest {
  url: string;
  title: string;
  description: string;
}

/**
 * An output of a session, such as a pull request.
 * This is a discriminated union based on the `type` property.
 * Maps to the `SessionOutput` message in the REST API.
 *
 * @example
 * (output: SessionOutput) => {
 *   if (output.type === 'pullRequest') {
 *     console.log('PR URL:', output.pullRequest.url);
 *   }
 * }
 */
export type SessionOutput =
  {
    type: 'pullRequest';
    pullRequest: PullRequest;
  }
;

/**
 * Represents the context used when the session was created.
 * Maps to the `SourceContext` message in the REST API.
 */
export interface SourceContext {
  /**
   * The name of the source (e.g., "sources/github/owner/repo").
   */
  source: string;
  /**
   * Context specific to GitHub repos.
   */
  githubRepoContext?: {
    startingBranch: string;
  };
}

/**
 * The underlying data structure representing a Session resource from the REST API.
 * The SDK enhances this with helper methods in the `SessionClient`.
 */
export interface SessionResource {
  /**
   * The full resource name (e.g., "sessions/314159...").
   */
  name: string;
  /**
   * The unique ID of the session.
   */
  id: string;
  prompt: string;
  sourceContext: SourceContext;
  title: string;
  /**
   * The time the session was created (RFC 3339 timestamp).
   */
  createTime: string;
  /**
   * The time the session was last updated (RFC 3339 timestamp).
   */
  updateTime: string;
  /**
   * The current state of the session.
   */
  state: SessionState;
  /**
   * The URL to view the session in the Jules web app.
   */
  url: string;
  /**
   * The outputs of the session, if any.
   */
  outputs: SessionOutput[];
}

// -----------------------------------------------------------------------------
// Activity and Artifact Types
// -----------------------------------------------------------------------------

// --- Plan Types ---

/**
 * A single step within an agent's plan.
 * Maps to the `PlanStep` message in the REST API.
 */
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  index: number;
}

/**
 * A sequence of steps that the agent will take to complete the task.
 * Maps to the `Plan` message in the REST API.
 */
export interface Plan {
  id: string;
  steps: PlanStep[];
  createTime: string;
}

// --- Artifact Types (Discriminated Union) ---

/**
 * A patch in Git's unidiff format.
 * Maps to the `GitPatch` message in the REST API.
 */
export interface GitPatch {
  /**
   * The patch content.
   */
  unidiffPatch: string;
  /**
   * The base commit id the patch should be applied to.
   */
  baseCommitId: string;
  /**
   * A suggested commit message for the.
   */
  suggestedCommitMessage: string;
}

/**
 * A set of changes to be applied to a source.
 * Maps to the `ChangeSet` message in the REST API.
 */
export interface ChangeSet {
  source: string;
  gitPatch: GitPatch;
}

/**
 * A media output (e.g., an image) with a helper method to save the data.
 * This is an SDK-specific enhancement.
 */
export interface MediaArtifact {
  readonly type: 'media';
  /**
   * The base64-encoded media data.
   */
  readonly data: string;
  /**
   * The format of the media (e.g., 'image/png').
   */
  readonly format: string;
  /**
   * Saves the media data to a file.
   * This method is only available in Node.js environments.
   *
   * @param filepath The path to save the file to.
   * @throws {Error} If called in a non-Node.js environment.
   *
   * @example
   * if (artifact.type === 'media' && artifact.format.startsWith('image/')) {
   *   await artifact.save('./screenshot.png');
   * }
   */
  save(filepath: string): Promise<void>;
}

/**
 * Output from a bash command execution, with a helper method to format the output.
 * This is an SDK-specific enhancement.
 */
export interface BashArtifact {
  readonly type: 'bashOutput';
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  /**
   * Returns a cleanly formatted string combining the command, output, and exit code.
   *
   * @example
   * if (artifact.type === 'bashOutput') {
   *   console.log(artifact.toString());
   * }
   */
  toString(): string;
}

/**
 * A single unit of data produced by an activity, enhanced with SDK helper methods.
 * This is a discriminated union based on the `type` property.
 * Maps to the `Artifact` resource in the REST API.
 *
 * @example
 * (artifact: Artifact) => {
 *   if (artifact.type === 'changeSet') {
 *     console.log(artifact.changeSet.gitPatch.suggestedCommitMessage);
 *   }
 * }
 */
export type Artifact =
  | { type: 'changeSet'; changeSet: ChangeSet }
  | MediaArtifact
  | BashArtifact;

// Raw REST API type definitions for artifacts, used by mappers.
// These represent the JSON structure before being mapped to rich SDK objects.

export interface RestChangeSetArtifact {
  changeSet: ChangeSet;
}

export interface RestMediaArtifact {
  media: {
    data: string;
    format: string;
  };
}

export interface RestBashOutputArtifact {
  bashOutput: {
    command:string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
  };
}

export type RestArtifact =
  | RestChangeSetArtifact
  | RestMediaArtifact
  | RestBashOutputArtifact;

// --- Activity Types (Discriminated Union) ---

/**
 * Base structure for all activities.
 */
interface BaseActivity {
  /**
   * The full resource name (e.g., "sessions/{session}/activities/{activity}").
   */
  name: string;
  id: string;
  /**
   * The time at which this activity was created (RFC 3339 timestamp).
   */
  createTime: string;
  /**
   * The entity that this activity originated from.
   */
  originator: 'user' | 'agent' | 'system';
  /**
   * The artifacts produced by this activity.
   */
  artifacts: Artifact[];
}

/**
 * An activity representing a message from the agent.
 */
export interface ActivityAgentMessaged extends BaseActivity {
  type: 'agentMessaged';
  /**
   * The message the agent posted.
   */
  message: string;
}

/**
 * An activity representing a message from the user.
 */
export interface ActivityUserMessaged extends BaseActivity {
  type: 'userMessaged';
  /**
   * The message the user posted.
   */
  message: string;
}

/**
 * An activity representing a newly generated plan.
 */
export interface ActivityPlanGenerated extends BaseActivity {
  type: 'planGenerated';
  /**
   * The plan that was generated.
   */
  plan: Plan;
}

/**
 * An activity representing the approval of a plan.
 */
export interface ActivityPlanApproved extends BaseActivity {
  type: 'planApproved';
  /**
   * The ID of the plan that was approved.
   */
  planId: string;
}

/**
 * An activity representing a progress update from the agent.
 */
export interface ActivityProgressUpdated extends BaseActivity {
  type: 'progressUpdated';
  /**
   * The title of the progress update.
   */
  title: string;
  /**
   * The description of the progress update.
   */
  description: string;
}

/**
 * An activity signifying the successful completion of a session.
 */
export interface ActivitySessionCompleted extends BaseActivity {
  type: 'sessionCompleted';
}

/**
 * An activity signifying the failure of a session.
 */
export interface ActivitySessionFailed extends BaseActivity {
  type: 'sessionFailed';
  /**
   * The reason the session failed.
   */
  reason: string;
}

/**
 * A single event or unit of work within a session.
 * This discriminated union represents all possible activities streamed by the SDK.
 * Maps to the `Activity` resource in the REST API.
 *
 * @example
 * (activity: Activity) => {
 *   switch (activity.type) {
 *     case 'planGenerated':
 *       console.log('Plan:', activity.plan.steps.map(s => s.title));
 *       break;
 *     case 'agentMessaged':
 *       console.log('Agent says:', activity.message);
 *       break;
 *   }
 * }
 */
export type Activity =
  | ActivityAgentMessaged
  | ActivityUserMessaged
  | ActivityPlanGenerated
  | ActivityPlanApproved
  | ActivityProgressUpdated
  | ActivitySessionCompleted
  | ActivitySessionFailed;

// =============================================================================
// SDK Abstraction Interfaces
// =============================================================================

// -----------------------------------------------------------------------------
// AutomatedSession Abstraction (Automation Paradigm)
// -----------------------------------------------------------------------------

/**
 * The final outcome of a completed session or run.
 * This is derived from the final SessionResource state.
 *
 * @example
 * (outcome: Outcome) => {
 *   if (outcome.state === 'completed' && outcome.pullRequest) {
 *     console.log(`Success! PR: ${outcome.pullRequest.url}`);
 *   }
 * }
 */
export interface Outcome {
  sessionId: string;
  title: string;
  state: 'completed' | 'failed';
  /**
   * The primary Pull Request created by the session, if applicable.
   */
  pullRequest?: PullRequest;
  /**
   * All outputs generated by the session.
   */
  outputs: SessionOutput[];
}

/**
 * Represents a Jules Session in automated mode, initiated by `jules.run()`.
 *
 * It is an enhanced Promise that resolves to the final Outcome when the task completes or fails.
 * It also provides methods for real-time observation.
 */
export interface AutomatedSession extends Promise<Outcome> {
  /**
   * Provides a real-time stream of activities as the automated run progresses.
   * This uses an Async Iterator, making it easy to consume events as they happen.
   *
   * @example
   * const run = jules.run({ ... });
   * for await (const activity of run.stream()) {
   *   console.log(`[${activity.type}]`);
   * }
   * const outcome = await run; // Await the promise itself for the final result.
   */
  stream(): AsyncIterable<Activity>;
}

// -----------------------------------------------------------------------------
// SessionClient (Interactive Paradigm)
// -----------------------------------------------------------------------------

/**
 * Represents an active, interactive session with the Jules agent.
 * This is the primary interface for managing the lifecycle of an interactive session.
 */
export interface SessionClient {
  /**
   * The unique ID of the session.
   */
  readonly id: string;

  /**
   * Provides a real-time stream of activities for the session.
   * This uses an Async Iterator to abstract the polling of the ListActivities endpoint.
   *
   * @example
   * for await (const activity of session.stream()) {
   *   if (activity.type === 'agentMessaged') {
   *     console.log('Agent:', activity.message);
   *   }
   * }
   */
  stream(): AsyncIterable<Activity>;

  /**
   * Approves the currently pending plan.
   * Only valid if the session state is `awaitingPlanApproval`.
   *
   * @example
   * await session.waitFor('awaitingPlanApproval');
   * await session.approve();
   */
  approve(): Promise<void>;

  /**
   * Sends a message (prompt) to the agent in the context of the current session.
   * This is a fire-and-forget operation. To see the response, use `stream()` or `ask()`.
   *
   * @param prompt The message to send.
   * @example
   * await session.send("Can you start working on the first step?");
   */
  send(prompt: string): Promise<void>;

  /**
   * Sends a message to the agent and waits specifically for the agent's immediate reply.
   * This provides a convenient request/response flow for conversational interactions.
   *
   * @param prompt The message to send.
   * @returns The agent's reply activity.
   * @example
   * const reply = await session.ask("What is the status of the plan?");
   * console.log(reply.message);
   */
  ask(prompt: string): Promise<ActivityAgentMessaged>;

  /**
   * Waits for the session to reach a terminal state (completed or failed) and returns the result.
   *
   * @returns The final outcome of the session.
   * @example
   * const outcome = await session.result();
   * console.log(`Session finished with state: ${outcome.state}`);
   */
  result(): Promise<Outcome>;

  /**
   * Pauses execution and waits until the session reaches a specific state.
   *
   * @param state The target state to wait for.
   * @example
   * console.log('Waiting for the agent to finish planning...');
   * await session.waitFor('awaitingPlanApproval');
   * console.log('Plan is ready for review.');
   */
  waitFor(state: SessionState): Promise<void>;

  /**
   * Retrieves the latest state of the underlying session resource from the API.
   *
   * @returns The latest session data.
   * @example
   * const sessionInfo = await session.info();
   * console.log(`Current state: ${sessionInfo.state}`);
   */
  info(): Promise<SessionResource>;
}

// -----------------------------------------------------------------------------
// SourceManager
// -----------------------------------------------------------------------------

/**
 * Interface for managing and locating connected sources.
 * Accessed via `jules.sources`.
 */
export interface SourceManager {
  /**
   * Iterates over all connected sources.
   * Uses an Async Iterator to abstract API pagination.
   *
   * @example
   * for await (const source of jules.sources()) {
   *   if (source.type === 'githubRepo') {
   *     console.log(`Found repo: ${source.githubRepo.owner}/${source.githubRepo.repo}`);
   *   }
   * }
   */
  (): AsyncIterable<Source>;

  /**
   * Locates a specific source based on ergonomic filters.
   *
   * @param filter The filter criteria (e.g., { github: 'owner/repo' }).
   * @returns The matching Source or undefined if not found.
   * @example
   * const myRepo = await jules.sources.get({ github: 'my-org/my-project' });
   */
  get(filter: { github: string }): Promise<Source | undefined>;
}

// -----------------------------------------------------------------------------
// Main Client Interface
// -----------------------------------------------------------------------------

/**
 * The main client interface for interacting with the Jules API.
 */
export interface JulesClient {
  /**
   * Executes a task in automated mode.
   * This is a high-level abstraction for "fire-and-forget" tasks.
   *
   * @param config The configuration for the run.
   * @returns A `AutomatedSession` object, which is an enhanced Promise that resolves to the final outcome.
   *
   * @example
   * const automatedSession = jules.run({
   *   prompt: "Fix the bug described in issue #123",
   *   source: { github: 'my-org/my-project', branch: 'main' }
   * });
   * const outcome = await automatedSession;
   */
  run(config: SessionConfig): AutomatedSession;

  /**
   * Creates a new interactive session for workflows requiring human oversight.
   *
   * @param config The configuration for the session.
   * @returns A Promise resolving to the interactive `SessionClient`.
   *
   * @example
   * const session = await jules.session({
   *   prompt: "Let's refactor the authentication module.",
   *   source: { github: 'my-org/my-project', branch: 'develop' }
   * });
   */
  session(config: SessionConfig): Promise<SessionClient>;
  /**
   * Rehydrates an existing session from its ID, allowing you to resume interaction.
   *
   * @param sessionId The ID of the existing session.
   * @returns The interactive `SessionClient`.
   *
   * @example
   * const session = jules.session('EXISTING_SESSION_ID');
   * // now you can interact with it
   * const info = await session.info();
   */
  session(sessionId: string): SessionClient;

  /**
   * Provides access to the Source Management interface.
   *
   * @example
   * const sources = jules.sources;
   * const allSources = await Array.fromAsync(sources());
   */
  sources: SourceManager;
}

/**
 * The main entry point for the Jules SDK.
 * This factory function initializes the Jules client.
 *
 * @param options Configuration options for the SDK.
 * @returns An initialized JulesClient instance.
 */
export declare function Jules(options?: JulesOptions): JulesClient;
