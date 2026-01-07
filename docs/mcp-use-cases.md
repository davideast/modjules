# MCP Server: Practical Use Cases

This guide shows you common requests you can make in natural language to an AI assistant and explains the `modjules` tools that are called in the background to fulfill them.

## Creating a Session
This is the most common starting point.

> **Prompt:** "Create a Jules session to refactor the authentication logic in the `my-org/my-app` repo on the `develop` branch."

-   **Tool:** `jules_create_session`
-   **Arguments:** `prompt`, `repo`, `branch`

## Checking on Progress
Once a session is running, you'll want to know what's happening.

> **Prompt:** "What's the status of the Jules session you just created?"

-   **Tool:** `jules_session_state`
-   **Why:** Gets a high-level overview: state, PR links, etc.

> **Prompt:** "Show me a timeline of what Jules has done so far."

-   **Tool:** `jules_session_timeline`
-   **Why:** Gets a chronological list of events (activities) for a detailed view.

## Reviewing Code Changes
This is a critical two-step workflow.

### Step 1: See which files have changed
> **Prompt:** "What files has Jules changed in session 12345?"

-   **Tool:** `jules_session_files`
-   **Result:** The tool returns a list of all files changed, and importantly, the `activityId` associated with each change. This ID is the key to the next step.

### Step 2: Get the diff for a specific file
> **Prompt:** "Show me the diff for `src/auth.ts`."

-   **Tool:** `jules_get_code_changes`
-   **Arguments:** `sessionId`, `activityId` (from previous step), `filePath`
-   **Result:** The tool returns the raw `unidiff` patch for that specific file, which the assistant can then display.

## Interacting with the Agent
For interactive sessions, you can approve plans and have a conversation.

> **Prompt:** "The plan looks good. Go ahead."

-   **Tool:** `jules_interact`
-   **Arguments:** `sessionId`, `action: "approve"`

> **Prompt:** "Ask Jules if it considered edge cases."

-   **Tool:** `jules_interact`
-   **Arguments:** `sessionId`, `action: "ask"`, `message`

## Auditing and Analyzing Work (`jules_select`)
The `jules_select` tool is the most powerful for analysis, allowing you to query the local cache of all session data.

**Important:** For the freshest results, you might first need to say: "Jules, sync my recent sessions." This triggers `jules_sync`.

### Finding Recent Failures
> **Prompt:** "Show me the last 5 sessions that failed."

-   **Tool:** `jules_select`
-   **Arguments:** `{ "from": "sessions", "where": { "state": "failed" }, "limit": 5 }`

### Searching for Specific Tasks
> **Prompt:** "Find all sessions where I asked Jules to work on 'authentication'."

-   **Tool:** `jules_select`
-   **Arguments:** `{ "from": "sessions", "where": { "prompt": { "contains": "authentication" } } }`

### Auditing Shell Commands
> **Prompt:** "List all the times Jules ran `npm install` and the command failed."

-   **Tool:** `jules_select`
-   **Arguments:** `{ "from": "activities", "where": { "artifacts.type": "bashOutput", "artifacts.command": { "contains": "npm install" }, "artifacts.exitCode": { "neq": 0 } } }`

## Getting a Deep Dive on a Single Session
When you need a full, structured summary of a session.

> **Prompt:** "Give me a complete breakdown of session 12345."

-   **Tool:** `jules_get_session_analysis_context`
-   **Why:** This tool is optimized to return a comprehensive snapshot of a session (timeline, code changes, test results) in a format perfect for an LLM to summarize for you.

## Improving Future Sessions with Analysis
You can use the analysis tools to find inefficiencies in past sessions and create artifacts to make future sessions more reliable.

> **Prompt:** "Analyze session `[ID]`. Identify any steps that were retried multiple times. Then, suggest a new bash script we could add to `scripts/setup-dev.sh` to make the environment setup more reliable for you in the future."

-   **Tool Chain:**
    1.  `jules_get_session_analysis_context` is called to get a structured breakdown of the session.
    2.  The assistant's LLM analyzes this context to identify patterns.
    3.  The assistant generates a recommendation, such as a new script or an `AGENTS.md` file.
-   **Why:** This turns Jules into a system that improves over time by analyzing its own work.
