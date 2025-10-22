
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

export interface JulesOptions {
  /**
   * The API key used for authentication.
   * If not provided, the SDK will attempt to read it from the JULES_API_KEY environment variable.
   * Authenticates requests via the `X-Goog-Api-Key` header.
   */
  apiKey?: string;
  /**
   * The base URL for the Jules API.
   * Defaults to 'https://jules.googleapis.com/v1alpha'.
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
   * If false (default for `jules.run()`), plans are auto-approved.
   * Maps to `requirePlanApproval` in the REST API.
   */
  requireApproval?: boolean;
  /**
   * If true (default for `jules.run()`), the agent will automatically create a Pull Request
   * when the task is completed.
   * Maps to `automationMode: AUTO_CREATE_PR` in the REST API.
   * If false, maps to `AUTOMATION_MODE_UNSPECIFIED`.
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
 * Represents a GitHub repository connected to Jules.
 * REST API: GitHubRepo
 */
export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate: boolean;
}

/**
 * An input source of data for a session (e.g., a GitHub repository).
 * REST API Resource: Source
 */
export type Source = {
  /**
   * Identifier. The full resource name (e.g., "sources/github/owner/repo").
   * REST API: Source.name
   */
  name: string;
  /**
   * The id of the source (e.g., "github/owner/repo").
   * REST API: Source.id
   */
  id: string;
} & (
  // Discriminated union for source types (mapping the `source` union field in REST)
  {
    type: 'githubRepo';
    githubRepo: GitHubRepo;
  }
  // | { type: 'otherSource', ... }
);

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

/**
 * State of a session.
 * REST API: State enum (converted to lowercase camelCase for idiomatic TS).
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
 * REST API: PullRequest
 */
export interface PullRequest {
  url: string;
  title: string;
  description: string;
}

/**
 * An output of a session.
 * REST API: SessionOutput (Uses a union field `output`)
 */
export type SessionOutput =
  // Discriminated union for outputs
  {
    type: 'pullRequest';
    pullRequest: PullRequest;
  }
  // | { type: 'otherOutput', ... }
;

/**
 * Represents the context used when the session was created.
 * REST API: SourceContext
 */
export interface SourceContext {
  /**
   * The name of the source (e.g., "sources/github/owner/repo").
   */
  source: string;
  /**
   * Context specific to GitHub repos.
   * REST API: GitHubRepoContext
   */
  githubRepoContext?: {
    startingBranch: string;
  };
}

/**
 * The underlying data structure representing a Session resource.
 * This is the structure returned by the REST API (GET /sessions/{id}).
 * REST API Resource: Session
 */
export interface SessionResource {
  /**
   * Output only. The full resource name (e.g., "sessions/314159...").
   */
  name: string;
  /**
   * Output only. The id of the session.
   */
  id: string;
  prompt: string;
  sourceContext: SourceContext;
  title: string;
  /**
   * Output only. The time the session was created (RFC 3339 timestamp).
   */
  createTime: string;
  /**
   * Output only. The time the session was last updated (RFC 3339 timestamp).
   */
  updateTime: string;
  /**
   * Output only. The current state of the session.
   */
  state: SessionState;
  /**
   * Output only. The URL to view the session in the Jules web app.
   */
  url: string;
  /**
   * Output only. The outputs of the session, if any.
   */
  outputs: SessionOutput[];
}

// -----------------------------------------------------------------------------
// Activity and Artifact Types
// -----------------------------------------------------------------------------

// --- Plan Types ---

/**
 * A step in a plan.
 * REST API: PlanStep
 */
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  index: number;
}

/**
 * A sequence of steps that the agent will take to complete the task.
 * REST API: Plan
 */
export interface Plan {
  id: string;
  steps: PlanStep[];
  createTime: string;
}

// --- Artifact Types (Discriminated Union) ---

/**
 * A patch in Git format.
 * REST API: GitPatch
 */
export interface GitPatch {
  /**
   * The patch in unidiff format.
   */
  unidiffPatch: string;
  /**
   * The base commit id the patch should be applied to.
   */
  baseCommitId: string;
  /**
   * A suggested commit message for the patch.
   */
  suggestedCommitMessage: string;
}

/**
 * A set of changes to be applied to a source.
 * REST API: ChangeSet
 */
export interface ChangeSet {
  source: string;
  // In the REST API this is a union field `changes`. We focus on gitPatch.
  gitPatch: GitPatch;
}

/**
 * A media output (e.g., an image).
 * This is an interactive object with a helper method to save the data.
 */
export interface MediaArtifact {
  readonly type: 'media';
  /**
   * The base64-encoded media data.
   */
  readonly data: string;
  /**
   * The format of the media (e.g., 'image/png').
   * Corresponds to `mimeType` in some API contexts.
   */
  readonly format: string;
  /**
   * Saves the media data to a file.
   * This method is only available in Node.js environments.
   * @param filepath The path to save the file to.
   * @throws {Error} If called in a non-Node.js environment.
   */
  save(filepath: string): Promise<void>;
}

/**
 * Output from a bash command execution.
 * This is an interactive object with a helper method to format the output.
 */
export interface BashArtifact {
  readonly type: 'bashOutput';
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  /**
   * Returns a cleanly formatted string combining the command, output, and exit code.
   */
  toString(): string;
}

/**
 * An artifact is a single unit of data produced by an activity step.
 * REST API: Artifact (Uses a union field `content`)
 *
 * This discriminated union represents the rich SDK objects, which may include
 * helper methods (e.g., `MediaArtifact.save()`).
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
    format: string; // Note: In some older docs this is mimeType
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
 * REST API Resource: Activity
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
   * REST API: Activity.originator
   */
  originator: 'user' | 'agent' | 'system';
  /**
   * The artifacts produced by this activity.
   * REST API: Activity.artifacts
   */
  artifacts: Artifact[];
}

// The following types map to the specific contents of the `activity` union field in the REST API.

export interface ActivityAgentMessaged extends BaseActivity {
  type: 'agentMessaged';
  /**
   * The message the agent posted.
   * REST API: AgentMessaged.agentMessage
   */
  message: string;
}

export interface ActivityUserMessaged extends BaseActivity {
  type: 'userMessaged';
  /**
   * The message the user posted.
   * REST API: UserMessaged.userMessage
   */
  message: string;
}

export interface ActivityPlanGenerated extends BaseActivity {
  type: 'planGenerated';
  /**
   * The plan that was generated.
   * REST API: PlanGenerated.plan
   */
  plan: Plan;
}

export interface ActivityPlanApproved extends BaseActivity {
  type: 'planApproved';
  /**
   * The ID of the plan that was approved.
   * REST API: PlanApproved.planId
   */
  planId: string;
}

export interface ActivityProgressUpdated extends BaseActivity {
  type: 'progressUpdated';
  /**
   * The title of the progress update.
   * REST API: ProgressUpdated.title
   */
  title: string;
  /**
   * The description of the progress update.
   * REST API: ProgressUpdated.description
   */
  description: string;
}

export interface ActivitySessionCompleted extends BaseActivity {
  type: 'sessionCompleted';
  // REST API: SessionCompleted (empty object)
}

export interface ActivitySessionFailed extends BaseActivity {
  type: 'sessionFailed';
  /**
   * The reason the session failed.
   * REST API: SessionFailed.reason
   */
  reason: string;
}

/**
 * An activity is a single unit of work within a session.
 * This discriminated union represents all possible activities streamed by the SDK.
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
// Run Abstraction (Automation Paradigm)
// -----------------------------------------------------------------------------

/**
 * The final outcome of a completed session or run.
 * This is derived from the final SessionResource state.
 */
export interface Outcome {
  sessionId: string;
  title: string;
  state: 'completed' | 'failed';
  /**
   * The primary Pull Request created by the session, if applicable.
   * Helper derived from session.outputs.
   */
  pullRequest?: PullRequest;
  /**
   * All outputs generated by the session.
   */
  outputs: SessionOutput[];
}

/**
 * Represents an ongoing automated task initiated by `jules.run()`.
 *
 * It is an enhanced Promise that resolves to the final Outcome when the task completes or fails.
 * It also provides methods for real-time observation.
 */
export interface Run extends Promise<Outcome> {
  /**
   * Provides a real-time stream of activities as the automated run progresses.
   *
   * This uses an Async Iterator to abstract the polling of the ListActivities endpoint.
   *
   * @example
   * const run = jules.run({...});
   * for await (const activity of run.stream()) {
   *   console.log(activity.type);
   * }
   * const outcome = await run; // Await the promise itself for the final result.
   *
   * REST API: GET /v1alpha/sessions/{SESSION_ID}/activities
   */
  stream(): AsyncIterable<Activity>;
}

// -----------------------------------------------------------------------------
// SessionClient (Interactive Paradigm)
// -----------------------------------------------------------------------------

/**
 * Represents an active, interactive session with the Jules agent.
 * This is the primary interface for managing the lifecycle of an interactive session.
 * It manages internal state and polling based on the underlying SessionResource.
 */
export interface SessionClient {
  /**
   * The unique ID of the session.
   */
  readonly id: string;

  /**
   * Provides a real-time stream of activities for the session.
   *
   * This uses an Async Iterator to abstract the polling of the ListActivities endpoint.
   *
   * @example
   * for await (const activity of session.stream()) {
   *   console.log(activity.type);
   * }
   *
   * REST API: GET /v1alpha/sessions/{SESSION_ID}/activities
   */
  stream(): AsyncIterable<Activity>;

  /**
   * Approves the currently pending plan.
   * Only valid if the session state is `awaitingPlanApproval`.
   *
   * REST API: POST /v1alpha/sessions/{SESSION_ID}:approvePlan
   */
  approve(): Promise<void>;

  /**
   * Sends a message (prompt) to the agent in the context of the current session.
   * This is a fire-and-forget operation. To see the response, use `stream()` or `ask()`.
   *
   * REST API: POST /v1alpha/sessions/{SESSION_ID}:sendMessage
   * @param prompt The message to send.
   */
  send(prompt: string): Promise<void>;

  /**
   * Sends a message to the agent and waits specifically for the agent's immediate reply.
   *
   * This abstracts the `sendMessage` call and the subsequent polling for the next
   * `agentMessaged` activity, providing a natural request/response flow.
   *
   * REST API: POST :sendMessage followed by GET /activities polling.
   * @param prompt The message to send.
   * @returns The agent's reply activity.
   */
  ask(prompt: string): Promise<ActivityAgentMessaged>;

  /**
   * Waits for the session to reach a terminal state (COMPLETED or FAILED).
   *
   * This abstracts the polling of the GetSession endpoint.
   *
   * REST API: GET /v1alpha/sessions/{SESSION_ID}
   * @returns The final outcome of the session.
   */
  result(): Promise<Outcome>;

  /**
   * Waits until the session reaches a specific state.
   *
   * REST API: GET /v1alpha/sessions/{SESSION_ID} (polling)
   * @param state The target state to wait for.
   */
  waitFor(state: SessionState): Promise<void>;

  /**
   * Retrieves the latest state of the underlying session resource.
   *
   * REST API: GET /v1alpha/sessions/{SESSION_ID}
   */
  info(): Promise<SessionResource>;
}

// -----------------------------------------------------------------------------
// SourceManager
// -----------------------------------------------------------------------------

/**
 * Interface for managing and locating connected sources.
 */
export interface SourceManager {
  /**
   * Iterates over all connected sources.
   * Uses an Async Iterator to abstract the pagination of the ListSources endpoint.
   *
   * @example
   * for await (const source of jules.sources()) { ... }
   *
   * REST API: GET /v1alpha/sources
   */
  (): AsyncIterable<Source>;

  /**
   * Locates a specific source based on ergonomic filters.
   *
   * REST API: GET /v1alpha/sources (fetches and filters client-side)
   * @param filter The filter criteria (e.g., { github: 'owner/repo' }).
   * @returns The matching Source or undefined if not found.
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
   *
   * This high-level abstraction handles the entire lifecycle: source resolution,
   * session creation, execution (with auto-approval by default), and completion.
   *
   * REST API: Orchestrates GET /sources, POST /sessions, and GET /sessions/{id} polling.
   *
   * @param config The configuration for the run.
   * @returns An enhanced Promise (Run) that resolves to the final Outcome.
   */
  run(config: SessionConfig): Run;

  /**
   * Creates a new interactive session.
   *
   * This mode is suitable for workflows requiring human interaction, such as plan approval
   * or iterative feedback.
   *
   * REST API: GET /sources (implicit resolution) and POST /sessions.
   *
   * @param config The configuration for the session.
   * @returns A Promise resolving to the interactive SessionClient.
   */
  session(config: SessionConfig): Promise<SessionClient>;

  /**
   * Rehydrates an existing session from its ID.
   *
   * This allows resuming interaction with a session in stateless environments.
   *
   * REST API: Subsequent calls will use GET /sessions/{SESSION_ID}.
   *
   * @param sessionId The ID of the existing session.
   * @returns The interactive SessionClient.
   */
  session(sessionId: string): SessionClient;

  /**
   * Provides access to the Source Management interface.
   */
  sources: SourceManager;
}

/**
 * The main entry point for the Jules SDK.
 * This factory function initializes the Jules client.
 *
 * @example
 * import { Jules } from '@jules-ai/sdk';
 * const jules = Jules();
 *
 * @param options Configuration options for the SDK.
 * @returns An initialized JulesClient instance.
 */
export declare function Jules(options?: JulesOptions): JulesClient;
