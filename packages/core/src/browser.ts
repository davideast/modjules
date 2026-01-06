// src/browser.ts
import { JulesClientImpl } from './client.js';
import { BrowserStorage } from './storage/browser.js';
import { MemorySessionStorage } from './storage/memory.js';
import { BrowserPlatform } from './platform/browser.js';
import { JulesClient, JulesOptions, StorageFactory } from './types.js';

const defaultPlatform = new BrowserPlatform();
const defaultStorageFactory: StorageFactory = {
  activity: (sessionId: string) => new BrowserStorage(sessionId),
  session: () => new MemorySessionStorage(), // Use Memory for now, upgrade to IndexedDB later
};

/**
 * Connects to the Jules service with the provided configuration.
 * Acts as a factory method for creating a new client instance.
 *
 * @param options Configuration options for the client.
 * @returns A new JulesClient instance.
 */
export function connect(options: JulesOptions = {}): JulesClient {
  return new JulesClientImpl(options, defaultStorageFactory, defaultPlatform);
}

/**
 * The main entry point for the Jules SDK for browser environments.
 * This is a pre-initialized client that can be used immediately with default settings.
 *
 * @example
 * import { jules } from 'modjules/browser';
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
} from './types.js';
