import type { JulesClient } from 'modjules';
import type {
  CodeChangesResult,
  FileChangeDetail,
  CodeChangesSummary,
} from './types.js';

/**
 * Extract a specific file's diff from a unidiff patch.
 */
function extractFileDiff(unidiffPatch: string, filePath: string): string {
  if (!unidiffPatch) {
    return '';
  }
  // Add a leading newline to handle the first entry correctly
  const patches = ('\n' + unidiffPatch).split('\ndiff --git ');
  const targetHeader = `a/${filePath} `;
  const patch = patches.find((p) => p.startsWith(targetHeader));

  return patch ? `diff --git ${patch}`.trim() : '';
}

/**
 * Get code changes from a specific activity in a Jules session.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID
 * @param activityId - The activity ID containing the changeSet
 * @param filePath - Optional file path to filter to a specific file
 * @returns Code changes with unidiff patch, file details, and summary
 */
export async function getCodeChanges(
  client: JulesClient,
  sessionId: string,
  activityId: string,
  filePath?: string,
): Promise<CodeChangesResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }
  if (!activityId) {
    throw new Error('activityId is required');
  }

  const session = client.session(sessionId);
  const activity = await session.activities.get(activityId).catch(() => {
    return undefined;
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  const changeSets = activity.artifacts.filter((a) => a.type === 'changeSet');

  if (changeSets.length === 0) {
    return {
      sessionId,
      activityId,
      ...(filePath && { filePath }),
      unidiffPatch: '',
      files: [],
      summary: {
        totalFiles: 0,
        created: 0,
        modified: 0,
        deleted: 0,
      },
    };
  }

  const changeSet = changeSets[0];
  let unidiffPatch = changeSet.gitPatch.unidiffPatch || '';
  const parsed = changeSet.parsed();
  let files: FileChangeDetail[] = parsed.files.map((f) => ({
    path: f.path,
    changeType: f.changeType,
    additions: f.additions,
    deletions: f.deletions,
  }));
  let summary: CodeChangesSummary = parsed.summary;

  if (filePath) {
    unidiffPatch = extractFileDiff(unidiffPatch, filePath);
    files = files.filter((f) => f.path === filePath);
    summary = {
      totalFiles: files.length,
      created: files.filter((f) => f.changeType === 'created').length,
      modified: files.filter((f) => f.changeType === 'modified').length,
      deleted: files.filter((f) => f.changeType === 'deleted').length,
    };
  }

  return {
    sessionId,
    activityId,
    ...(filePath && { filePath }),
    unidiffPatch,
    files,
    summary,
  };
}
