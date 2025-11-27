import React from 'react';
import {
  Activity,
  ActivityAgentMessaged,
  ActivityUserMessaged,
  ActivityPlanGenerated,
  ActivityPlanApproved,
  ActivityProgressUpdated,
  ActivitySessionCompleted,
  ActivitySessionFailed,
  Artifact,
} from 'modjules/types';

interface ActivityCardProps {
  activity: Activity;
}

const BaseCard = ({
  title,
  color,
  children,
  activity,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  activity: Activity;
}) => (
  <div className={`border-l-4 ${color} bg-white shadow-md rounded-lg p-6 mb-6`}>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <div className="text-sm text-gray-500">
        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
          {activity.type}
        </span>
        <span className="ml-2">
          {new Date(activity.createTime).toLocaleTimeString()}
        </span>
      </div>
    </div>
    <div className="space-y-4">{children}</div>
    {activity.artifacts.length > 0 && (
      <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Artifacts</h4>
        <div className="space-y-2">
          {activity.artifacts.map((artifact, i) => (
            <ArtifactView key={i} artifact={artifact} />
          ))}
        </div>
      </div>
    )}
  </div>
);

const ArtifactView = ({ artifact }: { artifact: Artifact }) => {
  if (artifact.type === 'changeSet') {
    return (
      <div className="bg-gray-50 p-4 rounded border">
        <div className="text-sm font-medium text-gray-700 mb-2">Change Set</div>
        <div className="text-xs text-gray-600 mb-2">
          Source: {artifact.changeSet.source}
        </div>
        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono">
          {artifact.changeSet.gitPatch.unidiffPatch}
        </pre>
      </div>
    );
  }
  if (artifact.type === 'bashOutput') {
    return (
      <div className="bg-gray-50 p-4 rounded border">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Bash Output
        </div>
        <div className="text-xs font-mono bg-gray-200 p-1 mb-2">
          {artifact.command}
        </div>
        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono">
          {artifact.stdout}
          {artifact.stderr && (
            <span className="text-red-400">{artifact.stderr}</span>
          )}
        </pre>
      </div>
    );
  }
  if (artifact.type === 'media') {
    return (
      <div className="bg-gray-50 p-4 rounded border">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Media ({artifact.format})
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:${artifact.format};base64,${artifact.data}`}
          alt="Artifact Media"
          className="max-w-full h-auto"
        />
      </div>
    );
  }
  return <div className="text-sm text-gray-500">Unknown Artifact Type</div>;
};

const UserMessaged = ({ activity }: { activity: ActivityUserMessaged }) => (
  <BaseCard title="User Message" color="border-blue-500" activity={activity}>
    <p className="text-gray-800 whitespace-pre-wrap">{activity.message}</p>
    <div className="mt-4 bg-blue-50 p-4 rounded text-sm text-blue-800">
      <strong>Explanation:</strong> This activity represents a message sent by
      the user to the agent. It contains the raw text of the user&apos;s request
      or feedback.
    </div>
  </BaseCard>
);

const AgentMessaged = ({ activity }: { activity: ActivityAgentMessaged }) => (
  <BaseCard title="Agent Message" color="border-green-500" activity={activity}>
    <p className="text-gray-800 whitespace-pre-wrap">{activity.message}</p>
    <div className="mt-4 bg-green-50 p-4 rounded text-sm text-green-800">
      <strong>Explanation:</strong> This activity represents a message sent by
      the agent to the user. It may contain text responses, questions, or
      explanations of actions taken.
    </div>
  </BaseCard>
);

const PlanGenerated = ({ activity }: { activity: ActivityPlanGenerated }) => (
  <BaseCard
    title="Plan Generated"
    color="border-purple-500"
    activity={activity}
  >
    <div className="bg-white border rounded-md overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b font-medium text-gray-700">
        Plan ID: {activity.plan.id}
      </div>
      <ul className="divide-y divide-gray-200">
        {activity.plan.steps.map((step) => (
          <li key={step.id} className="p-4">
            <div className="flex items-start">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold mr-3">
                {step.index + 1}
              </span>
              <div>
                <h5 className="text-sm font-medium text-gray-900">
                  {step.title}
                </h5>
                <p className="text-sm text-gray-500 mt-1">{step.description}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
    <div className="mt-4 bg-purple-50 p-4 rounded text-sm text-purple-800">
      <strong>Explanation:</strong> The agent generates a plan consisting of
      multiple steps to solve the user&apos;s problem. This activity exposes the
      structured plan object.
    </div>
  </BaseCard>
);

const PlanApproved = ({ activity }: { activity: ActivityPlanApproved }) => (
  <BaseCard title="Plan Approved" color="border-indigo-500" activity={activity}>
    <div className="flex items-center text-indigo-700">
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span>
        Plan <strong>{activity.planId}</strong> has been approved.
      </span>
    </div>
    <div className="mt-4 bg-indigo-50 p-4 rounded text-sm text-indigo-800">
      <strong>Explanation:</strong> This activity indicates that the user (or
      system in auto-mode) has approved the proposed plan, allowing the agent to
      proceed with execution.
    </div>
  </BaseCard>
);

const ProgressUpdated = ({
  activity,
}: {
  activity: ActivityProgressUpdated;
}) => (
  <BaseCard
    title="Progress Update"
    color="border-yellow-500"
    activity={activity}
  >
    <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
      <h4 className="font-semibold text-yellow-900">{activity.title}</h4>
      <p className="text-yellow-800 mt-1">{activity.description}</p>
    </div>
    <div className="mt-4 bg-yellow-50 p-4 rounded text-sm text-yellow-800">
      <strong>Explanation:</strong> As the agent works through the plan, it
      emits progress updates. These provide real-time feedback on what the agent
      is currently doing (e.g., &quot;Running tests&quot;, &quot;Writing
      code&quot;).
    </div>
  </BaseCard>
);

const SessionCompleted = ({
  activity,
}: {
  activity: ActivitySessionCompleted;
}) => (
  <BaseCard
    title="Session Completed"
    color="border-gray-800"
    activity={activity}
  >
    <div className="flex items-center text-green-600 font-medium">
      <svg
        className="w-6 h-6 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Session successfully completed.
    </div>
    <div className="mt-4 bg-gray-100 p-4 rounded text-sm text-gray-800">
      <strong>Explanation:</strong> This terminal activity marks the successful
      end of a session. It means the agent has finished its task.
    </div>
  </BaseCard>
);

const SessionFailed = ({ activity }: { activity: ActivitySessionFailed }) => (
  <BaseCard title="Session Failed" color="border-red-500" activity={activity}>
    <div className="flex items-center text-red-600 font-medium">
      <svg
        className="w-6 h-6 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Session failed.
    </div>
    <p className="text-red-700 mt-2">
      <strong>Reason:</strong> {activity.reason}
    </p>
    <div className="mt-4 bg-red-50 p-4 rounded text-sm text-red-800">
      <strong>Explanation:</strong> This terminal activity marks that the
      session has failed and cannot continue. It includes a reason for the
      failure.
    </div>
  </BaseCard>
);

export const ActivityCard = ({ activity }: ActivityCardProps) => {
  switch (activity.type) {
    case 'userMessaged':
      return <UserMessaged activity={activity} />;
    case 'agentMessaged':
      return <AgentMessaged activity={activity} />;
    case 'planGenerated':
      return <PlanGenerated activity={activity} />;
    case 'planApproved':
      return <PlanApproved activity={activity} />;
    case 'progressUpdated':
      return <ProgressUpdated activity={activity} />;
    case 'sessionCompleted':
      return <SessionCompleted activity={activity} />;
    case 'sessionFailed':
      return <SessionFailed activity={activity} />;
    default:
      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded text-red-800">
          Unknown activity type: {(activity as Activity).type}
        </div>
      );
  }
};
