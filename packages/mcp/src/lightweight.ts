import type {
  Activity,
  Artifact,
  LightweightActivity,
  MediaArtifact,
  StrippedMediaArtifact,
  LightweightArtifact,
} from 'modjules';
import { toSummary } from 'modjules';

export { toSummary };

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
