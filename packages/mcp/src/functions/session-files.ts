import type { JulesClient } from 'modjules';
import type { SessionFilesResult, FileChange, FilesSummary } from './types.js';

/**
 * Compute the net change type when a file has multiple changes.
 * created -> modified = created
 * created -> deleted = null (omit)
 * modified -> deleted = deleted
 */
function computeNetChangeType(
  first: 'created' | 'modified' | 'deleted',
  latest: 'created' | 'modified' | 'deleted',
): ('created' | 'modified' | 'deleted') | null {
  if (first === 'created' && latest === 'deleted') return null;
  if (first === 'created') return 'created';
  return latest;
}

/**
 * Get all files changed in a Jules session with aggregated change info.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to query
 * @returns Files with paths, change types, activity IDs, and line counts
 */
export async function getSessionFiles(
  client: JulesClient,
  sessionId: string,
): Promise<SessionFilesResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const session = client.session(sessionId);
  await session.activities.hydrate();
  const activities = await session.activities.select({ order: 'asc' });

  // Map: path -> { firstChangeType, latestChangeType, activityIds, additions, deletions }
  const fileMap = new Map<
    string,
    {
      firstChangeType: 'created' | 'modified' | 'deleted';
      latestChangeType: 'created' | 'modified' | 'deleted';
      activityIds: string[];
      additions: number;
      deletions: number;
    }
  >();

  for (const activity of activities) {
    for (const artifact of activity.artifacts) {
      if (artifact.type === 'changeSet') {
        const parsed = artifact.parsed();
        for (const file of parsed.files) {
          const existing = fileMap.get(file.path);
          if (existing) {
            existing.activityIds.push(activity.id);
            existing.additions += file.additions;
            existing.deletions += file.deletions;
            existing.latestChangeType = file.changeType;
          } else {
            fileMap.set(file.path, {
              firstChangeType: file.changeType,
              latestChangeType: file.changeType,
              activityIds: [activity.id],
              additions: file.additions,
              deletions: file.deletions,
            });
          }
        }
      }
    }
  }

  // Compute net changeType and filter out created->deleted
  const files: FileChange[] = [];
  for (const [path, info] of fileMap.entries()) {
    const netChangeType = computeNetChangeType(
      info.firstChangeType,
      info.latestChangeType,
    );
    if (netChangeType === null) continue;

    files.push({
      path,
      changeType: netChangeType,
      activityIds: info.activityIds,
      additions: info.additions,
      deletions: info.deletions,
    });
  }

  const summary: FilesSummary = {
    totalFiles: files.length,
    created: files.filter((f) => f.changeType === 'created').length,
    modified: files.filter((f) => f.changeType === 'modified').length,
    deleted: files.filter((f) => f.changeType === 'deleted').length,
  };

  return {
    sessionId,
    files,
    summary,
  };
}
