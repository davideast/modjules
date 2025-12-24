// src/index.ts
import { JulesClientImpl } from './client.js';
import { NodeFileStorage } from './storage/node-fs.js';
import { NodePlatform } from './platform/node.js';
import { JulesClient } from './types.js';

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
} from './types.js';

export { SessionCursor } from './sessions.js';
export type { ListSessionsOptions, ListSessionsResponse } from './sessions.js';

/**
 * The main entry point for the Jules SDK for Node.js environments.
 * This is a pre-initialized client that can be used immediately with default settings.
 *
 * @example
 * import { jules } from 'modjules';
 * const session = await jules.session({ ... });
 */
export const jules: JulesClient = new JulesClientImpl(
  {},
  (sessionId) => new NodeFileStorage(sessionId),
  new NodePlatform(),
);
