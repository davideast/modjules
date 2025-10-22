// src/mappers.ts
import { Artifact, Activity } from './types.js';

// Define the raw types from the REST API.
// This helps ensure type safety during mapping.

type RestArtifact = {
  changeSet?: object;
  media?: object;
  bashOutput?: object;
};

type RestActivity = {
  name: string;
  id: string;
  createTime: string;
  originator: 'user' | 'agent' | 'system';
  artifacts?: RestArtifact[];
  agentMessaged?: { agentMessage: string };
  userMessaged?: { userMessage: string };
  planGenerated?: { plan: object };
  planApproved?: { planId: string };
  progressUpdated?: { title: string; description: string };
  sessionCompleted?: object;
  sessionFailed?: { reason: string };
};

export function mapRestArtifactToSdkArtifact(artifact: RestArtifact): Artifact {
  if (artifact.changeSet) {
    return { type: 'changeSet', changeSet: artifact.changeSet as any };
  }
  if (artifact.media) {
    return { type: 'media', media: artifact.media as any };
  }
  if (artifact.bashOutput) {
    return { type: 'bashOutput', bashOutput: artifact.bashOutput as any };
  }
  throw new Error('Unknown artifact type');
}

export function mapRestActivityToSdkActivity(activity: RestActivity): Activity {
  const { name, id, createTime, originator } = activity;

  const artifacts = (activity.artifacts || []).map(mapRestArtifactToSdkArtifact);

  const baseActivity = {
    name,
    id,
    createTime,
    originator,
    artifacts,
  };

  if (activity.agentMessaged) {
    return {
      ...baseActivity,
      type: 'agentMessaged',
      message: activity.agentMessaged.agentMessage,
    };
  }
  if (activity.userMessaged) {
    return {
      ...baseActivity,
      type: 'userMessaged',
      message: activity.userMessaged.userMessage,
    };
  }
  if (activity.planGenerated) {
    return {
      ...baseActivity,
      type: 'planGenerated',
      plan: activity.planGenerated.plan as any,
    };
  }
  if (activity.planApproved) {
    return {
      ...baseActivity,
      type: 'planApproved',
      planId: activity.planApproved.planId,
    };
  }
  if (activity.progressUpdated) {
    return {
      ...baseActivity,
      type: 'progressUpdated',
      title: activity.progressUpdated.title,
      description: activity.progressUpdated.description,
    };
  }
  if (activity.sessionCompleted) {
    return {
      ...baseActivity,
      type: 'sessionCompleted',
    };
  }
  if (activity.sessionFailed) {
    return {
      ...baseActivity,
      type: 'sessionFailed',
      reason: activity.sessionFailed.reason,
    };
  }

  throw new Error('Unknown activity type');
}
