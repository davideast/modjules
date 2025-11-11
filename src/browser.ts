// src/browser.ts
import { JulesClientImpl } from './client.js';
import { BrowserStorage } from './storage/browser.js';
import { BrowserPlatform } from './platform/browser.js';
import { JulesClient } from './types.js';

/**
 * The main entry point for the Jules SDK for browser environments.
 * This is a pre-initialized client that can be used immediately with default settings.
 *
 * @example
 * import { jules } from 'julets/browser';
 * const session = await jules.session({ ... });
 */
export const jules: JulesClient = new JulesClientImpl(
  {},
  (sessionId) => new BrowserStorage(sessionId),
  new BrowserPlatform(),
);

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
