/**
 * Computed Fields for Jules Query Language
 *
 * Computed fields are derived at query time, not stored.
 * They can be selected but not filtered.
 */

import { Activity } from '../types.js';
import { toSummary } from '../activity/summary.js';

/**
 * List of computed field names for activities
 */
export const ACTIVITY_COMPUTED_FIELDS = ['artifactCount', 'summary'] as const;

/**
 * List of computed field names for sessions
 */
export const SESSION_COMPUTED_FIELDS = ['durationMs'] as const;

/**
 * Check if a field name is a computed field for activities
 */
export function isActivityComputedField(field: string): boolean {
  return ACTIVITY_COMPUTED_FIELDS.includes(
    field as (typeof ACTIVITY_COMPUTED_FIELDS)[number],
  );
}

/**
 * Check if a field name is a computed field for sessions
 */
export function isSessionComputedField(field: string): boolean {
  return SESSION_COMPUTED_FIELDS.includes(
    field as (typeof SESSION_COMPUTED_FIELDS)[number],
  );
}

/**
 * Compute the artifactCount for an activity
 */
export function computeArtifactCount(activity: Activity): number {
  return activity.artifacts?.length ?? 0;
}

/**
 * Compute the summary for an activity
 * Delegates to existing toSummary implementation
 */
export function computeSummary(activity: Activity): string {
  return toSummary(activity).summary;
}

/**
 * Compute the duration in milliseconds for a session
 */
export function computeDurationMs(session: {
  createTime?: string;
  updateTime?: string;
}): number {
  if (!session.createTime || !session.updateTime) return 0;

  const created = new Date(session.createTime).getTime();
  const updated = new Date(session.updateTime).getTime();

  if (isNaN(created) || isNaN(updated)) return 0;

  return Math.max(0, updated - created);
}

/**
 * Inject computed fields into an activity based on selected fields
 *
 * @param activity The activity to augment
 * @param selectFields The fields being selected (or undefined for default)
 * @returns Activity with computed fields added
 */
export function injectActivityComputedFields(
  activity: Activity,
  selectFields?: string[],
): Activity & { artifactCount?: number; summary?: string } {
  const result = { ...activity } as Activity & {
    artifactCount?: number;
    summary?: string;
  };

  // Determine which computed fields to include
  const includeAll =
    !selectFields || selectFields.length === 0 || selectFields.includes('*');

  const needsArtifactCount =
    includeAll || selectFields?.includes('artifactCount');
  const needsSummary = includeAll || selectFields?.includes('summary');

  if (needsArtifactCount) {
    result.artifactCount = computeArtifactCount(activity);
  }

  if (needsSummary) {
    result.summary = computeSummary(activity);
  }

  return result;
}

/**
 * Inject computed fields into a session based on selected fields
 *
 * @param session The session to augment
 * @param selectFields The fields being selected (or undefined for default)
 * @returns Session with computed fields added
 */
export function injectSessionComputedFields<
  T extends { createTime?: string; updateTime?: string },
>(session: T, selectFields?: string[]): T & { durationMs?: number } {
  const result = { ...session } as T & { durationMs?: number };

  const includeAll =
    !selectFields || selectFields.length === 0 || selectFields.includes('*');

  const needsDurationMs = includeAll || selectFields?.includes('durationMs');

  if (needsDurationMs) {
    result.durationMs = computeDurationMs(session);
  }

  return result;
}

/**
 * Default projection fields for activities (includes computed fields)
 */
export const DEFAULT_ACTIVITY_PROJECTION = [
  'id',
  'type',
  'createTime',
  'originator',
  'artifactCount',
  'summary',
];

/**
 * Default projection fields for sessions
 */
export const DEFAULT_SESSION_PROJECTION = [
  'id',
  'state',
  'title',
  'createTime',
];
