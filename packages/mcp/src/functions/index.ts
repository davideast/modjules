/**
 * Pure functions for Jules MCP operations.
 * These functions can be used independently of the MCP server.
 */

// Export all functions
export { getSessionState } from './session-state.js';
export { getSessionTimeline } from './session-timeline.js';
export { getSessionFiles } from './session-files.js';
export { getBashOutputs } from './bash-outputs.js';
export { getCodeChanges } from './code-changes.js';
export { listSessions } from './list-sessions.js';
export { createSession } from './create-session.js';
export { interact } from './interact.js';
export { select } from './select.js';
export { sync } from './sync.js';
export { getSchema } from './schema.js';
export { getQueryHelp } from './query-help.js';
export { validateQuery } from './validate-query.js';
export { getAnalysisContext } from './analysis-context.js';
export { replaySession } from './replay-session.js';

// Export all types
export type {
  // Session State
  SessionStateResult,
  // Timeline
  LightweightActivity,
  TimelineResult,
  TimelineOptions,
  // Session Files
  FileChange,
  FilesSummary,
  SessionFilesResult,
  // Bash Outputs
  BashOutput,
  BashOutputsSummary,
  BashOutputsResult,
  // Code Changes
  FileChangeDetail,
  CodeChangesSummary,
  CodeChangesResult,
  // List Sessions
  ListSessionsOptions,
  ListSessionsResult,
  // Create Session
  CreateSessionOptions,
  CreateSessionResult,
  // Interact
  InteractAction,
  InteractResult,
  // Select
  SelectOptions,
  SelectResult,
  // Sync
  SyncOptions,
  SyncResult,
  // Schema
  SchemaFormat,
  SchemaDomain,
  SchemaResult,
  // Query Help
  QueryHelpTopic,
  // Validate Query
  ValidationResult,
  // Replay Session
  ReplayStep,
  ReplayProgress,
  ReplayContext,
  ReplaySessionResult,
  ReplayFilter,
} from './types.js';
