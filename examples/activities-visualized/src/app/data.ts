import {
  ActivityAgentMessaged,
  ActivityUserMessaged,
  ActivityPlanGenerated,
  ActivityPlanApproved,
  ActivityProgressUpdated,
  ActivitySessionCompleted,
  ActivitySessionFailed,
  Activity,
  Plan,
} from 'modjules/types';

const timestamp = new Date().toISOString();

const mockPlan: Plan = {
  id: 'plan-123',
  createTime: timestamp,
  steps: [
    {
      id: 'step-1',
      title: 'Analyze requirements',
      description: 'Review the user request and codebase.',
      index: 0,
    },
    {
      id: 'step-2',
      title: 'Implement feature',
      description: 'Write the code for the new feature.',
      index: 1,
    },
    {
      id: 'step-3',
      title: 'Verify changes',
      description: 'Run tests to ensure everything works.',
      index: 2,
    },
  ],
};

export const activities: Activity[] = [
  {
    type: 'userMessaged',
    name: 'sessions/123/activities/1',
    id: '1',
    createTime: timestamp,
    originator: 'user',
    message: 'Please add a new login button to the header.',
    artifacts: [],
  } as ActivityUserMessaged,
  {
    type: 'agentMessaged',
    name: 'sessions/123/activities/2',
    id: '2',
    createTime: timestamp,
    originator: 'agent',
    message:
      'I can help with that. I will start by analyzing the current header implementation.',
    artifacts: [],
  } as ActivityAgentMessaged,
  {
    type: 'planGenerated',
    name: 'sessions/123/activities/3',
    id: '3',
    createTime: timestamp,
    originator: 'agent',
    plan: mockPlan,
    artifacts: [],
  } as ActivityPlanGenerated,
  {
    type: 'planApproved',
    name: 'sessions/123/activities/4',
    id: '4',
    createTime: timestamp,
    originator: 'user',
    planId: mockPlan.id,
    artifacts: [],
  } as ActivityPlanApproved,
  {
    type: 'progressUpdated',
    name: 'sessions/123/activities/5',
    id: '5',
    createTime: timestamp,
    originator: 'agent',
    title: 'Implementing feature',
    description:
      'Working on step 2: Implement feature. Added Button component.',
    artifacts: [],
  } as ActivityProgressUpdated,
  {
    type: 'agentMessaged',
    name: 'sessions/123/activities/6',
    id: '6',
    createTime: timestamp,
    originator: 'agent',
    message: 'I have created the login button. Here is the change set.',
    artifacts: [
      {
        type: 'changeSet',
        changeSet: {
          source: 'sources/github/owner/repo',
          gitPatch: {
            baseCommitId: 'abc1234',
            suggestedCommitMessage: 'feat: add login button',
            unidiffPatch: `diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 83a0429..92b3c4d 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -10,6 +10,7 @@ export const Header = () => {
       <nav>
         <a href="/">Home</a>
         <a href="/about">About</a>
+        <button onClick={login}>Login</button>
       </nav>
     </header>
   );`,
          },
        },
      },
    ],
  } as ActivityAgentMessaged,
  {
    type: 'sessionCompleted',
    name: 'sessions/123/activities/7',
    id: '7',
    createTime: timestamp,
    originator: 'system',
    artifacts: [],
  } as ActivitySessionCompleted,
  {
    type: 'sessionFailed',
    name: 'sessions/123/activities/8',
    id: '8',
    createTime: timestamp,
    originator: 'system',
    reason: 'Connection timed out while waiting for user input.',
    artifacts: [],
  } as ActivitySessionFailed,
];
