import {
  Activity,
  ActivitySummary,
  ActivityAgentMessaged,
  Artifact,
  LightweightActivity,
  MediaArtifact,
  ActivityPlanGenerated,
  ActivityProgressUpdated,
  ActivityUserMessaged,
  StrippedMediaArtifact,
  LightweightArtifact,
  ActivitySessionFailed,
} from '../types.js';

const MAX_SUMMARY_LENGTH = 200;

/**
 * Creates a concise summary for an activity.
 * @param activity The activity to summarize.
 * @returns A summary of the activity.
 */
export function toSummary(activity: Activity): ActivitySummary {
  const { id, type, createTime } = activity;
  let summary: string = type; // Default fallback is the type name

  switch (activity.type) {
    case 'agentMessaged':
    case 'userMessaged': {
      const message = (activity as ActivityAgentMessaged | ActivityUserMessaged)
        .message;
      if (!message || message.length === 0) {
        summary = type; // Fallback to type name for empty messages
      } else if (message.length > MAX_SUMMARY_LENGTH) {
        summary = message.substring(0, MAX_SUMMARY_LENGTH) + '...';
      } else {
        summary = message;
      }
      break;
    }
    case 'progressUpdated': {
      const progress = activity as ActivityProgressUpdated;
      // Handle missing title/description gracefully
      if (progress.title && progress.description) {
        summary = `${progress.title}: ${progress.description}`;
      } else if (progress.title) {
        summary = progress.title;
      } else if (progress.description) {
        summary = progress.description;
      }
      // else: fallback to type name (already set)
      break;
    }
    case 'planGenerated': {
      const plan = activity as ActivityPlanGenerated;
      const stepCount = plan.plan?.steps?.length ?? 0;
      summary = `Plan generated with ${stepCount} steps`;
      break;
    }
    case 'planApproved':
      summary = 'Plan approved';
      break;
    case 'sessionCompleted':
      summary = 'Session completed';
      break;
    case 'sessionFailed': {
      const failed = activity as ActivitySessionFailed;
      summary = failed.reason
        ? `Session failed: ${failed.reason}`
        : 'Session failed';
      break;
    }
  }

  return { id, type, createTime, summary };
}

/**
 * Converts an activity to a lightweight format.
 * @param activity The activity to convert.
 * @param options Options for the conversion.
 * @returns A lightweight representation of the activity.
 */
export function toLightweight(
  activity: Activity,
  options?: { includeArtifacts?: boolean },
): LightweightActivity {
  const summary = toSummary(activity);
  const artifactCount = activity.artifacts?.length ?? 0;
  let artifacts: LightweightArtifact[] | null = null;

  if (options?.includeArtifacts && activity.artifacts) {
    artifacts = activity.artifacts.map((artifact: Artifact) => {
      if (artifact.type === 'media') {
        const mediaArtifact = artifact as MediaArtifact;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data, ...rest } = mediaArtifact;
        const strippedArtifact: StrippedMediaArtifact = {
          ...rest,
          dataStripped: true,
          hasData: true,
        };
        return strippedArtifact;
      }
      return artifact;
    });
  }

  return { ...summary, artifacts, artifactCount };
}
