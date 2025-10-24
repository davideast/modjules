# Jules API Guide

## Introduction

The Jules API lets you programmatically access Jules's capabilities to automate and enhance your software development lifecycle. You can use the API to create custom workflows, automate tasks like bug fixing and code reviews, and embed Jules's intelligence directly into the tools you use every day, such as Slack, Linear, and GitHub.

> **Note:** The Jules API is in an alpha release, which means it is experimental. Be aware that we may change specifications, API keys, and definitions as we work toward stabilization. In the future, we plan to maintain at least one stable and one experimental version.

## Authentication

To get started with the Jules API, you'll need an API key.

### Generate Your API Key

In the Jules web app, go to the **Settings** page to create a new API key. You can have at most 3 API keys at a time.

### Use Your API Key

To authenticate your requests, pass the API key in the `X-Goog-Api-Key` header of your API calls.

> **Important:** Keep your API keys secure. Don't share them or embed them in public code. For your protection, any API keys found to be publicly exposed will be automatically disabled to prevent abuse.

## API concepts

The Jules API is built around a few core resources. Understanding these will help you use the API effectively.

*   **Source**: An input source for the agent (e.g., a GitHub repository). Before using a source using the API, you must first install the Jules GitHub app through the Jules web app.
*   **Session**: A continuous unit of work within a specific context, similar to a chat session. A session is initiated with a prompt and a source.
*   **Activity**: A single unit of work within a Session. A Session contains multiple activities from both the user and the agent, such as generating a plan, sending a message, or updating progress.

## Quickstart: Your first API call

We'll walk through creating your first session with the Jules API using curl.

### Step 1: List your available sources

First, you need to find the name of the source you want to work with (e.g., your GitHub repo). This command will return a list of all sources you have connected to Jules.

```sh
curl 'https://jules.googleapis.com/v1alpha/sources' \
    -H 'X-Goog-Api-Key: YOUR_API_KEY'
```

The response will look something like this:

```json
{
  "sources": [
    {
      "name": "sources/github/bobalover/boba",
      "id": "github/bobalover/boba",
      "githubRepo": {
        "owner": "bobalover",
        "repo": "boba"
      }
    }
  ],
  "nextPageToken": "github/bobalover/boba-web"
}
```

### Step 2: Create a new session

Now, create a new session. You'll need the source name from the previous step. This request tells Jules to create a boba app in the specified repository.

```sh
curl 'https://jules.googleapis.com/v1alpha/sessions' \
    -X POST \
    -H "Content-Type: application/json" \
    -H 'X-Goog-Api-Key: YOUR_API_KEY' \
    -d '{
      "prompt": "Create a boba app!",
      "sourceContext": {
        "source": "sources/github/bobalover/boba",
        "githubRepoContext": {
          "startingBranch": "main"
        }
      },
      "automationMode": "AUTO_CREATE_PR",
      "title": "Boba App"
    }'
```

The `automationMode` field is optional. By default, no PR will be automatically created.

The immediate response will look something like this:

```json
{
    "name": "sessions/31415926535897932384",
    "id": "31415926535897932384",
    "title": "Boba App",
    "sourceContext": {
      "source": "sources/github/bobalover/boba",
      "githubRepoContext": {
        "startingBranch": "main"
      }
    },
    "prompt": "Create a boba app!"
}
```

You can poll the latest session information using GetSession or ListSessions. For example, if a PR was automatically created, you can see the PR in the session output.

```json
{
  "name": "sessions/31415926535897932384",
  "id": "31415926535897932384",
  "title": "Boba App",
  "sourceContext": {
    "source": "sources/github/bobalover/boba",
    "githubRepoContext": {
      "startingBranch": "main"
    }
  },
  "prompt": "Create a boba app!",
  "outputs": [
    {
      "pullRequest": {
        "url": "https://github.com/bobalover/boba/pull/35",
        "title": "Create a boba app",
        "description": "This change adds the initial implementation of a boba app."
      }
    }
  ]
}
```

By default, sessions created through the API will have their plans automatically approved. If you want to create a session that requires explicit plan approval, set the `requirePlanApproval` field to `true`.

### Step 3: Listing sessions

You can list your sessions as follows.

```sh
curl 'https://jules.googleapis.com/v1alpha/sessions?pageSize=5' \
    -H 'X-Goog-Api-Key: YOUR_API_KEY'
```

### Step 4: Approve plan

If your session requires explicit plan approval, you can approve the latest plan as follows:

```sh
curl 'https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:approvePlan' \
    -X POST \
    -H "Content-Type: application/json" \
    -H 'X-Goog-Api-Key: YOUR_API_KEY'
```

### Step 5: Activities and interacting with the agent

To list activities in a session:

```sh
curl 'https://jules.googleapis.com/v1alpha/sessions/SESSION_ID/activities?pageSize=30' \
    -H 'X-Goog-Api-Key: YOUR_API_KEY'
```

To send a message to the agent:

```sh
curl 'https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:sendMessage' \
    -X POST \
    -H "Content-Type: application/json" \
    -H 'X-Goog-Api-Key: YOUR_API_KEY' \
    -d '{
      "prompt": "Can you make the app corgi themed?"
    }'
```

The response will be empty because the agent will send its response in the next activity. To see the agent's response, list the activities again.

Here is an example of a ListActivities response.

```json
{
  "activities": [
    {
      "name": "sessions/14550388554331055113/activities/02200cce44f746308651037e4a18caed",
      "createTime": "2025-10-03T05:43:42.801654Z",
      "originator": "agent",
      "planGenerated": {
        "plan": {
          "id": "5103d604240042cd9f59a4cb2355643a",
          "steps": [
            { "id": "705a61fc8ec24a98abc9296a3956fb6b", "title": "Setup the environment. I will install the dependencies to run the app." },
            { "id": "bb5276efad354794a4527e9ad7c0cd42", "title": "Modify `src/App.js`. I will replace the existing React boilerplate with a simple Boba-themed component. This will include a title and a list of boba options.", "index": 1 },
            { "id": "377c9a1c91764dc794a618a06772e3d8", "title": "Modify `src/App.css`. I will update the CSS to provide a fresh, modern look for the Boba app.", "index": 2 },
            { "id": "335802b585b449aeabb855c722cd9c40", "title": "Frontend Verification. I will use the `frontend_verification_instructions` tool to get instructions on how to write a Playwright script to verify the frontend application and generate a screenshot of the changes.", "index": 3 },
            { "id": "3e4cc97c7b2448668d1ac75b8c7b7d69", "title": "Submit the changes. Once the app is looking good and verified, I will submit my work.", "index": 4 }
          ]
        }
      },
      "id": "02200cce44f746308651037e4a18caed"
    },
    {
      "name": "sessions/14550388554331055113/activities/2918fac8bc54450a9cbda423b7688413",
      "createTime": "2025-10-03T05:43:44.954030Z",
      "originator": "user",
      "planApproved": { "planId": "5103d604240042cd9f59a4cb2355643a" },
      "id": "2918fac8bc54450a9cbda423b7688413"
    },
    {
      "name": "sessions/14550388554331055113/activities/5b3acd1b3ca2439f9cbaefaccf7f709a",
      "createTime": "2025-10-03T05:44:16.700231Z",
      "originator": "agent",
      "progressUpdated": { "title": "Ran bash command", "description": "Command: \nnpm install\nOutput: added 1326 packages, and audited 1327 packages in 25s\n\n268 packages are looking for fundingExit Code: 0" },
      "artifacts": [ { "bashOutput": { "command": "\nnpm install", "output": "added 1326 packages, and audited 1327 packages in 25s\n\n268 packages are looking for funding" } } ],
      "id": "5b3acd1b3ca2439f9cbaefaccf7f709a"
    },
    {
      "name": "sessions/14550388554331055113/activities/a76b35353eda42d09b1c37aedaa56047",
      "createTime": "2025-10-03T05:47:49.628363Z",
      "originator": "agent",
      "progressUpdated": { "title": "Frontend verification", "description": "Agent provided UI verification." },
      "artifacts": [ { "media": { "data": "<actual_image_bytes>", "mimeType": "image/png" } } ],
      "id": "a76b35353eda42d09b1c37aedaa56047"
    },
    {
      "name": "sessions/14550388554331055113/activities/022837dbc0e940eabcc1bc53608e15fc",
      "createTime": "2025-10-03T05:48:35.523200Z",
      "originator": "agent",
      "sessionCompleted": {},
      "artifacts": [
        {
          "changeSet": {
            "source": "sources/github/bobalover/boba",
            "gitPatch": {
              "unidiffPatch": "<actual_unidiff>",
              "baseCommitId": "36ead0a4caefc451b9652ed926a15af9570f4f35",
              "suggestedCommitMessage": "feat: Create simple Boba App\n\nThis commit transforms the default Create React App boilerplate into a simple, visually appealing Boba-themed application."
            }
          }
        }
      ],
      "id": "022837dbc0e940eabcc1bc53608e15fc"
    }
  ]
}
```

- [Resource: Session](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#Session)
  - [JSON representation](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#Session.SCHEMA_REPRESENTATION)
- [SourceContext](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SourceContext)
  - [JSON representation](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SourceContext.SCHEMA_REPRESENTATION)
- [GitHubRepoContext](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#GitHubRepoContext)
  - [JSON representation](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#GitHubRepoContext.SCHEMA_REPRESENTATION)
- [AutomationMode](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#AutomationMode)
- [State](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#State)
- [SessionOutput](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SessionOutput)
  - [JSON representation](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SessionOutput.SCHEMA_REPRESENTATION)
- [PullRequest](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#PullRequest)
  - [JSON representation](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#PullRequest.SCHEMA_REPRESENTATION)
- [Methods](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#METHODS_SUMMARY)

## Resource: Session

A session is a contiguous amount of work within the same context.

|                                                                                                                                                                                                                                                                                                      JSON representation                                                                                                                                                                                                                                                                                                       |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ``` { "name": string, "id": string, "prompt": string, "sourceContext": { object (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SourceContext) }, "title": string, "requirePlanApproval": boolean, "automationMode": enum (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#AutomationMode), "createTime": string, "updateTime": string, "state": enum (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#State), "url": string, "outputs": [ { object (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SessionOutput) } ] } ``` |

|                                                                                                                                                                                                                   Fields                                                                                                                                                                                                                    ||
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`                | `string` Output only. Identifier. The full resource name (e.g., "sessions/{session}").                                                                                                                                                                                                                                                                                                                               |
| `id`                  | `string` Output only. The id of the session. This is the same as the "{session}" part of the resource name (e.g., "sessions/{session}").                                                                                                                                                                                                                                                                             |
| `prompt`              | `string` Required. The prompt to start the session with.                                                                                                                                                                                                                                                                                                                                                             |
| `sourceContext`       | `object (`[SourceContext](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SourceContext)`)` Required. The source to use in this session, with additional context.                                                                                                                                                                                                                            |
| `title`               | `string` Optional. If not provided, the system will generate one.                                                                                                                                                                                                                                                                                                                                                    |
| `requirePlanApproval` | `boolean` Optional. Input only. If true, plans the agent generates will require explicit plan approval before the agent starts working. If not set, plans will be auto-approved.                                                                                                                                                                                                                                     |
| `automationMode`      | `enum (`[AutomationMode](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#AutomationMode)`)` Optional. Input only. The automation mode of the session. If not set, the default automation mode will be used.                                                                                                                                                                                  |
| `createTime`          | `string (`[Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp)` format)` Output only. The time the session was created. Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`.      |
| `updateTime`          | `string (`[Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp)` format)` Output only. The time the session was last updated. Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `state`               | `enum (`[State](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#State)`)` Output only. The state of the session.                                                                                                                                                                                                                                                                             |
| `url`                 | `string` Output only. The URL of the session to view the session in the Jules web app.                                                                                                                                                                                                                                                                                                                               |
| `outputs[]`           | `object (`[SessionOutput](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#SessionOutput)`)` Output only. The outputs of the session, if any.                                                                                                                                                                                                                                                 |

## SourceContext

Context for how to use a source in a session.

|                                                                                                                               JSON representation                                                                                                                                |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ``` { "source": string, // Union field `context` can be only one of the following: "githubRepoContext": { object (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#GitHubRepoContext) } // End of list of possible types for union field `context`. } ``` |

|                                                                                           Fields                                                                                           ||
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `source`            | `string` Required. The name of the source this context is for. To get the list of sources, use the ListSources API. Format: sources/{source}                          |
| Union field `context`. The context for how to use the source in a session. `context` can be only one of the following:                                                                     ||
| `githubRepoContext` | `object (`[GitHubRepoContext](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#GitHubRepoContext)`)` Context to use a GitHubRepo in a session. |

## GitHubRepoContext

Context to use a GitHubRepo in a session.

|         JSON representation          |
|--------------------------------------|
| ``` { "startingBranch": string } ``` |

|                                         Fields                                         ||
|------------------|----------------------------------------------------------------------|
| `startingBranch` | `string` Required. The name of the branch to start the session from. |

## AutomationMode

The automation mode of the session.

|                                                                              Enums                                                                              ||
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `AUTOMATION_MODE_UNSPECIFIED` | The automation mode is unspecified. Default to no automation.                                                                    |
| `AUTO_CREATE_PR`              | Whenever a final code patch is generated in the session, automatically create a branch and a pull request for it, if applicable. |

## State

State of a session.

|                               Enums                               ||
|--------------------------|-----------------------------------------|
| `STATE_UNSPECIFIED`      | The state is unspecified.               |
| `QUEUED`                 | The session is queued.                  |
| `PLANNING`               | The agent is planning.                  |
| `AWAITING_PLAN_APPROVAL` | The agent is waiting for plan approval. |
| `AWAITING_USER_FEEDBACK` | The agent is waiting for user feedback. |
| `IN_PROGRESS`            | The session is in progress.             |
| `PAUSED`                 | The session is paused.                  |
| `FAILED`                 | The session has failed.                 |
| `COMPLETED`              | The session has completed.              |

## SessionOutput

An output of a session.

|                                                                                                               JSON representation                                                                                                                |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ``` { // Union field `output` can be only one of the following: "pullRequest": { object (https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#PullRequest) } // End of list of possible types for union field `output`. } ``` |

|                                                                                        Fields                                                                                        ||
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Union field `output`. An output of the session. `output` can be only one of the following:                                                                                           ||
| `pullRequest` | `object (`[PullRequest](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions#PullRequest)`)` A pull request created by the session, if applicable. |

## PullRequest

A pull request.

|                        JSON representation                        |
|-------------------------------------------------------------------|
| ``` { "url": string, "title": string, "description": string } ``` |

|                            Fields                            ||
|---------------|-----------------------------------------------|
| `url`         | `string` The URL of the pull request.         |
| `title`       | `string` The title of the pull request.       |
| `description` | `string` The description of the pull request. |

|                                                                     ## Methods                                                                      ||
|--------------------------------------------------------------------------------------------------------|---------------------------------------------|
| ### [approvePlan](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/approvePlan) | Approves a plan in a session.               |
| ### [create](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/create)           | Creates a new session.                      |
| ### [get](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/get)                 | Gets a single session.                      |
| ### [list](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/list)               | Lists all sessions.                         |
| ### [sendMessage](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/sendMessage) | Sends a message from the user to a session. |

# REST Resource: sessions.activities

## Resource: Activity
An activity is a single unit of work within a session.

### JSON Representation
```json
{
  "name": "string",
  "id": "string",
  "description": "string",
  "createTime": "string",
  "originator": "string",
  "artifacts": [
    {
      "object (Artifact)": {}
    }
  ],

  // Union field `activity` can be only one of the following:
  "agentMessaged": {
    "object (AgentMessaged)": {}
  },
  "userMessaged": {
    "object (UserMessaged)": {}
  },
  "planGenerated": {
    "object (PlanGenerated)": {}
  },
  "planApproved": {
    "object (PlanApproved)": {}
  },
  "progressUpdated": {
    "object (ProgressUpdated)": {}
  },
  "sessionCompleted": {
    "object (SessionCompleted)": {}
  },
  "sessionFailed": {
    "object (SessionFailed)": {}
  }
  // End of list of possible types for union field `activity`.
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Identifier. The full resource name (e.g., "sessions/{session}/activities/{activity}"). |
| `id` | string | Output only. The id of the activity. This is the same as the "{activity}" part of the resource name (e.g., "sessions/{session}/activities/{activity}"). |
| `description` | string | Output only. A description of this activity. |
| `createTime` | string (Timestamp format) | Output only. The time at which this activity was created. Uses RFC 3339. |
| `originator` | string | The entity that this activity originated from (e.g. "user", "agent", "system"). |
| `artifacts[]` | object (Artifact) | Output only. The artifacts produced by this activity. |
| **Union field `activity`** | | **The activity content. `activity` can be only one of the following:** |
| `agentMessaged` | object (AgentMessaged) | The agent posted a message. |
| `userMessaged` | object (UserMessaged) | The user posted a message. |
| `planGenerated` | object (PlanGenerated) | A plan was generated. |
| `planApproved` | object (PlanApproved) | A plan was approved. |
| `progressUpdated` | object (ProgressUpdated) | There was a progress update. |
| `sessionCompleted` | object (SessionCompleted) | The session was completed. |
| `sessionFailed` | object (SessionFailed) | The session failed. |

---

## AgentMessaged
The agent posted a message.

### JSON Representation
```json
{
  "agentMessage": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `agentMessage` | string | The message the agent posted. |

---

## UserMessaged
The user posted a message.

### JSON Representation
```json
{
  "userMessage": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `userMessage` | string | The message the user posted. |

---

## PlanGenerated
A plan was generated.

### JSON Representation
```json
{
  "plan": {
    "object (Plan)": {}
  }
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `plan` | object (Plan) | The plan that was generated. |

---

## Plan
A plan is a sequence of steps that the agent will take to complete the task.

### JSON Representation
```json
{
  "id": "string",
  "steps": [
    {
      "object (PlanStep)": {}
    }
  ],
  "createTime": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Output only. ID for this plan; unique within a session. |
| `steps[]` | object (PlanStep) | Output only. The steps in the plan. |
| `createTime` | string (Timestamp format) | Output only. Time when the plan was created. Uses RFC 3339. |

---

## PlanStep
A step in a plan.

### JSON Representation
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "index": "integer"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Output only. ID for this step; unique within a plan. |
| `title` | string | Output only. The title of the step. |
| `description` | string | Output only. The description of the step. |
| `index` | integer | Output only. 0-based index into the plan.steps. |

---

## PlanApproved
A plan was approved.

### JSON Representation
```json
{
  "planId": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `planId` | string | The ID of the plan that was approved. |

---

## ProgressUpdated
There was a progress update.

### JSON Representation
```json
{
  "title": "string",
  "description": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `title` | string | The title of the progress update. |
| `description` | string | The description of the progress update. |

---

## SessionCompleted
The session was completed. This type has no fields.

---

## SessionFailed
The session failed.

### JSON Representation
```json
{
  "reason": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `reason` | string | The reason the session failed. |

---

## Artifact
An artifact is a single unit of data produced by an activity step.

### JSON Representation
```json
{
  // Union field `content` can be only one of the following:
  "changeSet": {
    "object (ChangeSet)": {}
  },
  "media": {
    "object (Media)": {}
  },
  "bashOutput": {
    "object (BashOutput)": {}
  }
  // End of list of possible types for union field `content`.
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| **Union field `content`** | | **The artifact content. `content` can be only one of the following:** |
| `changeSet` | object (ChangeSet) | A change set was produced (e.g. code changes). |
| `media` | object (Media) | A media file was produced (e.g. image, video). |
| `bashOutput` | object (BashOutput) | A bash output was produced. |

---

## ChangeSet
A set of changes to be applied to a source.

### JSON Representation
```json
{
  "source": "string",

  // Union field `changes` can be only one of the following:
  "gitPatch": {
    "object (GitPatch)": {}
  }
  // End of list of possible types for union field `changes`.
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `source` | string | The name of the source this change set applies to. Format: sources/{source} |
| **Union field `changes`** | | **The changes to be applied to the source. `changes` can be only one of the following:** |
| `gitPatch` | object (GitPatch) | A patch in Git format. |

---

## GitPatch
A patch in Git format.

### JSON Representation
```json
{
  "unidiffPatch": "string",
  "baseCommitId": "string",
  "suggestedCommitMessage": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `unidiffPatch` | string | The patch in unidiff format. |
| `baseCommitId` | string | The base commit id of the patch. This is the id of the commit that the patch should be applied to. |
| `suggestedCommitMessage` | string | A suggested commit message for the patch, if one is generated. |

---

## Media
A media output.

### JSON Representation
```json
{
  "data": "string",
  "mimeType": "string"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `data` | string (bytes format) | The media data. A base64-encoded string. |
| `mimeType` | string | The media mime type. |

---

## BashOutput
A bash output.

### JSON Representation
```json
{
  "command": "string",
  "output": "string",
  "exitCode": "integer"
}
```

### Fields
| Field | Type | Description |
| --- | --- | --- |
| `command` | string | The bash command. |
| `output` | string | The bash output. Includes both stdout and stderr. |
| `exitCode` | integer | The bash exit code. |

---

# Methods

*   **`get`**: Gets a single activity.
*   **`list`**: Lists activities for a session.

# REST Resource: sources

## Resource: Source

An input source of data for a session.

### JSON representation

```json
{
  "name": "string",
  "id": "string",

  // Union field `source` can be only one of the following:
  "githubRepo": {
    "object": "GitHubRepo"
  }
  // End of list of possible types for union field `source`.
}
```

### Fields

| Field        | Type                          | Description                                                                                             |
| :----------- | :---------------------------- | :------------------------------------------------------------------------------------------------------ |
| `name`       | string                        | Identifier. The full resource name (e.g., "sources/{source}").                                          |
| `id`         | string                        | Output only. The id of the source. This is the same as the "{source}" part of the resource name.          |
| **Union field `source`**: The input data source. `source` can be only one of the following: |
| `githubRepo` | object (`GitHubRepo`)         | A GitHub repo.                                                                                          |

## GitHubRepo

A GitHub repo.

### JSON representation

```json
{
  "owner": "string",
  "repo": "string",
  "isPrivate": "boolean",
  "defaultBranch": {
    "object": "GitHubBranch"
  },
  "branches": [
    {
      "object": "GitHubBranch"
    }
  ]
}
```

### Fields

| Field           | Type                     | Description                                                                                             |
| :-------------- | :----------------------- | :------------------------------------------------------------------------------------------------------ |
| `owner`         | string                   | The owner of the repo; the `<owner>` in `https://github.com/<owner>/<repo>`.                              |
| `repo`          | string                   | The name of the repo; the `<repo>` in `https://github.com/<owner>/<repo>`.                                |
| `isPrivate`     | boolean                  | Whether this repo is private.                                                                           |
| `defaultBranch` | object (`GitHubBranch`)  | The default branch for this repo.                                                                       |
| `branches[]`    | object (`GitHubBranch`)  | The list of active branches for this repo.                                                              |

## GitHubBranch

A GitHub branch.

### JSON representation

```json
{
  "displayName": "string"
}
```

### Fields

| Field         | Type   | Description                |
| :------------ | :----- | :------------------------- |
| `displayName` | string | The name of the GitHub branch. |

## Methods

*   **`get`**: Gets a single source.
*   **`list`**: Lists sources.