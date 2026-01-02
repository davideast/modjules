// src/index.ts
import { homedir } from 'node:os';
import { accessSync, constants, existsSync } from 'node:fs';
import * as path from 'node:path';
import { JulesClientImpl } from './client.js';
import { NodeFileStorage, NodeSessionStorage } from './storage/node-fs.js';
import { NodePlatform } from './platform/node.js';
import { JulesClient, JulesOptions, StorageFactory } from './types.js';

export function isWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function getRootDir(): string {
  // 1. Explicit environment variable (highest priority)
  const julesHome = process.env.JULES_HOME;
  if (julesHome && isWritable(julesHome)) {
    return julesHome;
  }

  // 2. Project-first: If package.json exists in cwd, use project-local cache
  const cwd = process.cwd();
  const isInProject = existsSync(path.join(cwd, 'package.json'));
  if (isInProject && cwd !== '/' && isWritable(cwd)) {
    return cwd;
  }

  // 3. HOME environment variable
  const home = process.env.HOME;
  if (home && home !== '/' && isWritable(home)) {
    return home;
  }

  // 4. os.homedir() (may use /etc/passwd on Unix)
  const osHome = homedir();
  if (osHome && osHome !== '/' && isWritable(osHome)) {
    return osHome;
  }

  // 5. Temporary directory as last resort
  const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  return tmpDir;
}

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
