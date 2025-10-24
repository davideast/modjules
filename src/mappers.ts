// src/mappers.ts
import { MediaArtifact, BashArtifact } from './artifacts.js';
import { AutomatedSessionFailedError } from './errors.js';
import {
  Activity,
  Artifact,
  Outcome,
  PullRequest,
  RestArtifact,
  SessionResource,
} from './types.js';

/**
 * Maps a raw REST API Activity resource to the SDK's discriminated union `Activity` type.
 * This function acts as a transformer, converting the API's structure (with union fields)
 * into a more idiomatic TypeScript structure (with a 'type' discriminator).
 *
 * @param restActivity The raw activity object from the REST API.
 * @returns A structured `Activity` object for the SDK.
 * @internal
 */
/**
 * Maps a raw REST API Artifact resource to the SDK's `Artifact` type.
 * This now instantiates rich classes for certain artifact types.
 *
 * @param restArtifact The raw artifact object from the REST API.
 * @returns A structured `Artifact` object for the SDK.
 * @internal
 */
export function mapRestArtifactToSdkArtifact(
  restArtifact: RestArtifact,
): Artifact {
  if ('changeSet' in restArtifact) {
    return { type: 'changeSet', changeSet: restArtifact.changeSet };
  }
  if ('media' in restArtifact) {
    return new MediaArtifact(restArtifact.media);
  }
  if ('bashOutput' in restArtifact) {
    return new BashArtifact(restArtifact.bashOutput);
  }
  // This provides a fallback, though the API should always provide a known type.
  throw new Error(`Unknown artifact type: ${JSON.stringify(restArtifact)}`);
}

export function mapRestActivityToSdkActivity(restActivity: any): Activity {
  const { name, createTime, originator, artifacts: rawArtifacts } = restActivity;

  // First, map the artifacts since they are common to all activities.
  const artifacts: Artifact[] = (rawArtifacts || []).map(
    mapRestArtifactToSdkArtifact,
  );

  const baseActivity = {
    name,
    id: name.split('/').pop(),
    createTime,
    originator: originator || 'system',
    artifacts,
  };

  if (restActivity.agentMessaged) {
    return {
      ...baseActivity,
      type: 'agentMessaged',
      message: restActivity.agentMessaged.agentMessage,
    };
  }
  if (restActivity.userMessaged) {
    return {
      ...baseActivity,
      type: 'userMessaged',
      message: restActivity.userMessaged.userMessage,
    };
  }
  if (restActivity.planGenerated) {
    return {
      ...baseActivity,
      type: 'planGenerated',
      plan: restActivity.planGenerated.plan,
    };
  }
  if (restActivity.planApproved) {
    return {
      ...baseActivity,
      type: 'planApproved',
      planId: restActivity.planApproved.planId,
    };
  }
  if (restActivity.progressUpdated) {
    return {
      ...baseActivity,
      type: 'progressUpdated',
      title: restActivity.progressUpdated.title,
      description: restActivity.progressUpdated.description,
    };
  }
  if (restActivity.sessionCompleted) {
    return {
      ...baseActivity,
      type: 'sessionCompleted',
    };
  }
  if (restActivity.sessionFailed) {
    return {
      ...baseActivity,
      type: 'sessionFailed',
      reason: restActivity.sessionFailed.reason,
    };
  }

  // Fallback for unknown activity types.
  throw new Error('Unknown activity type');
}

/**
 * Maps the final state of a SessionResource to a user-facing Outcome object.
 * This includes extracting the primary pull request and handling the failed state.
 *
 * @param session The final SessionResource from the API.
 * @returns The corresponding Outcome object.
 * @throws {AutomatedSessionFailedError} If the session state is 'failed'.
 */
export function mapSessionResourceToOutcome(
  session: SessionResource,
): Outcome {
  if (session.state === 'failed') {
    // TODO: The reason is not available on the session resource directly.
    // This will be improved when the API provides a failure reason.
    throw new AutomatedSessionFailedError(`Session ${session.id} failed.`);
  }

  // Find the pull request output, if it exists.
  const prOutput = session.outputs.find(o => 'pullRequest' in o);
  const pullRequest = prOutput
    ? (prOutput as { pullRequest: PullRequest }).pullRequest
    : undefined;

  return {
    sessionId: session.id,
    title: session.title,
    state: 'completed', // We only call this mapper on a completed session.
    pullRequest,
    outputs: session.outputs,
  };
}
