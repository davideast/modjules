import type { JulesClient } from 'modjules';
import type {
  ReplaySessionResult,
  ReplayStep,
  ReplayFilter,
  ReplayContext,
} from './types.js';

interface StepData {
  type: 'message' | 'plan' | 'bash' | 'code';
  activity?: {
    message?: string;
    originator?: string;
    plan?: { steps: unknown[] };
  };
  artifact?: {
    command?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    gitPatch?: { unidiffPatch?: string };
  };
  attempt?: number;
  totalAttempts?: number;
}

/**
 * Step through a Jules session one activity at a time with full artifact content.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to replay
 * @param cursor - Optional cursor for step navigation
 * @param filter - Optional filter: 'bash', 'code', or 'message'
 * @returns Replay step with progress and navigation cursors
 */
export async function replaySession(
  client: JulesClient,
  sessionId: string,
  cursor?: string,
  filter?: ReplayFilter,
): Promise<ReplaySessionResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }
  if (filter && !['bash', 'code', 'message'].includes(filter)) {
    throw new Error('Invalid filter. Must be one of: bash, code, message');
  }

  const session = client.session(sessionId);
  await session.activities.hydrate();
  const activities = await session.activities.select({ order: 'asc' });

  // Build step list from activities, where each artifact is a step
  let stepList: StepData[] = [];
  for (const activity of activities) {
    if (activity.type === 'agentMessaged' || activity.type === 'userMessaged') {
      stepList.push({
        type: 'message',
        activity: activity as StepData['activity'],
      });
    } else if (activity.type === 'planGenerated') {
      stepList.push({
        type: 'plan',
        activity: activity as StepData['activity'],
      });
    } else if (activity.type === 'progressUpdated') {
      for (const artifact of activity.artifacts) {
        if (artifact.type === 'bashOutput') {
          stepList.push({
            type: 'bash',
            artifact: artifact as StepData['artifact'],
          });
        } else if (artifact.type === 'changeSet') {
          stepList.push({
            type: 'code',
            artifact: artifact as StepData['artifact'],
          });
        }
      }
    }
  }

  // Post-process stepList to add retry detection for bash commands
  for (let i = 0; i < stepList.length; i++) {
    const currentStep = stepList[i];
    if (currentStep.type === 'bash') {
      // Look ahead for consecutive identical commands
      const retryChain = [currentStep];
      let j = i + 1;
      while (
        j < stepList.length &&
        stepList[j].type === 'bash' &&
        stepList[j].artifact?.command === currentStep.artifact?.command &&
        stepList[j].artifact?.stderr === currentStep.artifact?.stderr
      ) {
        retryChain.push(stepList[j]);
        j++;
      }

      if (retryChain.length > 1) {
        for (let k = 0; k < retryChain.length; k++) {
          retryChain[k].attempt = k + 1;
          retryChain[k].totalAttempts = retryChain.length;
        }
        // Skip the rest of the chain
        i = j - 1;
      }
    }
  }

  // Filter step list if a filter is provided
  if (filter) {
    stepList = stepList.filter((step) => step.type === filter);
  }

  if (stepList.length === 0) {
    throw new Error('No replayable steps found in session');
  }

  // Parse cursor to get the index of the step to retrieve
  let requestedIndex = 0;
  if (cursor) {
    const match = cursor.match(/^step_(\d+)$/);
    if (match) {
      requestedIndex = parseInt(match[1], 10);
    } else {
      throw new Error('Invalid cursor format');
    }
  }

  // Check bounds
  if (requestedIndex < 0 || requestedIndex >= stepList.length) {
    throw new Error('Invalid cursor');
  }

  const currentStepData = stepList[requestedIndex];
  let step: ReplayStep;

  // Format the step based on its type
  switch (currentStepData.type) {
    case 'message':
      step = {
        type: 'message',
        content: currentStepData.activity?.message,
        originator: currentStepData.activity?.originator,
      };
      break;
    case 'plan':
      step = {
        type: 'plan',
        content: currentStepData.activity?.plan?.steps,
      };
      break;
    case 'bash':
      step = {
        type: 'bash',
        command: currentStepData.artifact?.command,
        stdout: currentStepData.artifact?.stdout,
        stderr: currentStepData.artifact?.stderr,
        exitCode: currentStepData.artifact?.exitCode,
        ...(currentStepData.attempt && {
          attempt: currentStepData.attempt,
        }),
        ...(currentStepData.totalAttempts && {
          totalAttempts: currentStepData.totalAttempts,
        }),
      };
      break;
    case 'code':
      step = {
        type: 'code',
        unidiffPatch: currentStepData.artifact?.gitPatch?.unidiffPatch,
      };
      break;
  }

  // Calculate progress and cursors
  const total = stepList.length;
  const current = requestedIndex + 1;
  const pad = (n: number) => String(n).padStart(3, '0');

  const nextCursor =
    requestedIndex < total - 1 ? `step_${pad(requestedIndex + 1)}` : null;
  const prevCursor =
    requestedIndex > 0 ? `step_${pad(requestedIndex - 1)}` : null;

  // Include context only on the first request
  let context: ReplayContext | null = null;
  if (!cursor) {
    const info = await session.info();
    context = {
      sessionId: info.id,
      title: info.title,
      source: info.source,
    };
  }

  return {
    step,
    progress: { current, total },
    nextCursor,
    prevCursor,
    context,
  };
}
