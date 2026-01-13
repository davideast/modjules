/**
 * Return types for pure MCP functions.
 * These types define the shape of data returned by functions,
 * independent of MCP protocol formatting.
 */

import type { SessionResource } from 'modjules';

// ============================================================================
// Session State
// ============================================================================

export interface SessionStateResult {
  id: string;
  state: string;
  url: string;
  title: string;
  pr?: {
    url: string;
    title: string;
  };
}

// ============================================================================
// Session Timeline
// ============================================================================

export interface LightweightActivity {
  id: string;
  type: string;
  createTime: string;
  summary: string;
  artifactCount: number;
  message?: string;
  artifacts?: unknown[];
}

export interface TimelineResult {
  activities: LightweightActivity[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface TimelineOptions {
  limit?: number;
  startAfter?: string;
  order?: 'asc' | 'desc';
  type?: string;
}

// ============================================================================
// Session Files
// ============================================================================

export interface FileChange {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
  activityIds: string[];
  additions: number;
  deletions: number;
}

export interface FilesSummary {
  totalFiles: number;
  created: number;
  modified: number;
  deleted: number;
}

export interface SessionFilesResult {
  sessionId: string;
  files: FileChange[];
  summary: FilesSummary;
}

// ============================================================================
// Bash Outputs
// ============================================================================

export interface BashOutput {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  activityId: string;
}

export interface BashOutputsSummary {
  totalCommands: number;
  succeeded: number;
  failed: number;
}

export interface BashOutputsResult {
  sessionId: string;
  outputs: BashOutput[];
  summary: BashOutputsSummary;
}

// ============================================================================
// Code Changes
// ============================================================================

export interface FileChangeDetail {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

export interface CodeChangesSummary {
  totalFiles: number;
  created: number;
  modified: number;
  deleted: number;
}

export interface CodeChangesResult {
  sessionId: string;
  activityId: string;
  filePath?: string;
  unidiffPatch: string;
  files: FileChangeDetail[];
  summary: CodeChangesSummary;
}

// ============================================================================
// List Sessions
// ============================================================================

export interface ListSessionsOptions {
  pageSize?: number;
  pageToken?: string;
}

export interface ListSessionsResult {
  sessions: SessionResource[];
  nextPageToken?: string;
}

// ============================================================================
// Create Session
// ============================================================================

export interface CreateSessionOptions {
  prompt: string;
  /** GitHub repository (owner/repo). Optional for repoless sessions. */
  repo?: string;
  /** Target branch. Optional for repoless sessions. */
  branch?: string;
  interactive?: boolean;
  autoPr?: boolean;
}

export interface CreateSessionResult {
  id: string;
}

// ============================================================================
// Interact
// ============================================================================

export type InteractAction = 'approve' | 'send' | 'ask';

export interface InteractResult {
  success: boolean;
  message?: string;
  reply?: string;
}

// ============================================================================
// Select
// ============================================================================

export interface SelectOptions {
  tokenBudget?: number;
}

export interface SelectResult<T = unknown> {
  results: T[];
  _meta?: {
    truncated: boolean;
    tokenCount: number;
    tokenBudget: number;
  };
}

// ============================================================================
// Sync
// ============================================================================

export interface SyncOptions {
  sessionId?: string;
  depth?: 'metadata' | 'activities';
}

/**
 * Metrics resulting from a completed sync job.
 */
export interface SyncResult {
  sessionsIngested: number;
  activitiesIngested: number;
  isComplete: boolean;
  durationMs: number;
}

// ============================================================================
// Schema
// ============================================================================

export type SchemaFormat = 'json' | 'markdown';
export type SchemaDomain = 'sessions' | 'activities' | 'all';

export interface SchemaResult {
  content: string | object;
  format: SchemaFormat;
}

// ============================================================================
// Query Help
// ============================================================================

export type QueryHelpTopic =
  | 'where'
  | 'select'
  | 'operators'
  | 'examples'
  | 'errors';

// ============================================================================
// Validate Query
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  message: string;
}

// ============================================================================
// Replay Session
// ============================================================================

export interface ReplayStep {
  type: 'message' | 'plan' | 'bash' | 'code';
  content?: string | unknown[];
  originator?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  unidiffPatch?: string;
  attempt?: number;
  totalAttempts?: number;
}

export interface ReplayProgress {
  current: number;
  total: number;
}

export interface ReplayContext {
  sessionId: string;
  title: string;
  source: unknown;
}

export interface ReplaySessionResult {
  step: ReplayStep;
  progress: ReplayProgress;
  nextCursor: string | null;
  prevCursor: string | null;
  context: ReplayContext | null;
}

export type ReplayFilter = 'bash' | 'code' | 'message';
