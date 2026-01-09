import type { JulesClient } from 'modjules';
import type {
  BashOutputsResult,
  BashOutput,
  BashOutputsSummary,
} from './types.js';

/**
 * Get all bash command outputs from a Jules session.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to query
 * @returns Bash outputs with commands, stdout/stderr, exit codes, and summary
 */
export async function getBashOutputs(
  client: JulesClient,
  sessionId: string,
): Promise<BashOutputsResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const session = client.session(sessionId);
  await session.activities.hydrate();

  const activities = await session.activities.select({
    order: 'asc',
  });

  const outputs: BashOutput[] = [];
  const summary: BashOutputsSummary = {
    totalCommands: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const activity of activities) {
    for (const artifact of activity.artifacts) {
      if (artifact.type === 'bashOutput') {
        outputs.push({
          command: artifact.command,
          stdout: artifact.stdout,
          stderr: artifact.stderr,
          exitCode: artifact.exitCode,
          activityId: activity.id,
        });
        summary.totalCommands++;
        if (artifact.exitCode === 0 || artifact.exitCode === null) {
          summary.succeeded++;
        } else {
          summary.failed++;
        }
      }
    }
  }

  return {
    sessionId,
    outputs,
    summary,
  };
}
