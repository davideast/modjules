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
} from '../types.js';

const MAX_SUMMARY_LENGTH = 200;

/**
 * Creates a concise summary for an activity.
 * @param activity The activity to summarize.
 * @returns A summary of the activity.
 */
export function toSummary(activity: Activity): ActivitySummary {
  const { id, type, createTime } = activity;
  let summary: string = type;

  switch (activity.type) {
    case 'agentMessaged':
    case 'userMessaged':
      const message = (activity as ActivityAgentMessaged | ActivityUserMessaged)
        .message;
      if (message.length > MAX_SUMMARY_LENGTH) {
        summary = message.substring(0, MAX_SUMMARY_LENGTH) + '...';
      } else {
        summary = message;
      }
      break;
    case 'progressUpdated':
      const progress = activity as ActivityProgressUpdated;
      summary = `${progress.title}: ${progress.description}`;
      break;
    case 'planGenerated':
      const plan = activity as ActivityPlanGenerated;
      summary = `Plan generated with ${plan.plan.steps.length} steps`;
      break;
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
