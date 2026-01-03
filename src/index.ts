// src/index.ts
import { JulesClientImpl } from './client.js';
import { NodeFileStorage, NodeSessionStorage } from './storage/node-fs.js';
import { NodePlatform } from './platform/node.js';
import { JulesClient, JulesOptions, StorageFactory } from './types.js';
import { getRootDir } from './storage/root.js';

// Define defaults for the Node.js environment
const defaultPlatform = new NodePlatform();
const defaultStorageFactory: StorageFactory = {
  activity: (sessionId: string) => new NodeFileStorage(sessionId, getRootDir()),
  session: () => new NodeSessionStorage(getRootDir()),
};

/**
 * Connects to the Jules service using Node.js defaults (File System, Native Crypto).
 * Acts as a factory method for creating a new client instance.
 *
 * @param options Configuration options for the client.
 * @returns A new JulesClient instance.
 */
export function connect(options: JulesOptions = {}): JulesClient {
  return new JulesClientImpl(options, defaultStorageFactory, defaultPlatform);
}

/**
 * The main entry point for the Jules SDK.
 * This is a pre-initialized client that can be used immediately with default settings
 * (e.g., reading API keys from environment variables).
 *
 * @example
 * import { jules } from 'modjules';
 * const session = await jules.session({ ... });
 */
export const jules: JulesClient = connect();

// Re-export all the types for convenience
export * from './errors.js';
export type {
  Activity,
  ActivityAgentMessaged,
  ActivityPlanApproved,
  ActivityPlanGenerated,
  ActivityProgressUpdated,
  ActivitySessionCompleted,
  ActivitySessionFailed,
  ActivityUserMessaged,
  Artifact,
  AutomatedSession,
  BashArtifact,
  ChangeSet,
  GitHubRepo,
  GitPatch,
  JulesClient,
  JulesOptions,
  MediaArtifact,
  Outcome,
  Plan,
  PlanStep,
  PullRequest,
  SessionClient,
  SessionConfig,
  SessionOutput,
  SessionResource,
  SessionState,
  Source,
  SourceContext,
  SourceInput,
  SourceManager,
  JulesQuery,
  JulesDomain,
} from './types.js';

export { SessionCursor } from './sessions.js';
export type { ListSessionsOptions, ListSessionsResponse } from './sessions.js';
