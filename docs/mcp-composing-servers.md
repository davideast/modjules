# Composing MCP Servers

The true power of the Model Context Protocol (MCP) is unlocked when you compose multiple, specialized tool servers together. An AI assistant can act as an orchestrator, using the right tool for the right job by combining tools from different servers.

This guide shows you how to combine the `modjules` MCP server with a hypothetical GitHub MCP server to create a powerful, autonomous workflow.

## The Concept: An Ecosystem of Tools

Think of each MCP server as a specialist:

- **`modjules` server:** An expert at reading and writing code.
- **`github` server:** An expert at managing repositories, pull requests, and issues.

By enabling both, your AI assistant can seamlessly switch between these roles. It can use the GitHub server to understand a pull request and then use the `modjules` server to refactor the code within it.

## Configuration

To enable multiple servers, you simply add them to your `.mcp.json` file. The assistant will have access to all the tools from all the servers you define.

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "@modjules/mcp"],
      "env": {
        "JULES_API_KEY": "<YOUR_JULES_API_KEY>"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@github/mcp-server"],
      "env": {
        "GITHUB_TOKEN": "<YOUR_GITHUB_TOKEN>"
      }
    }
  }
}
```

Now, your assistant has access to both `jules_*` and `github_*` tools.

## Autonomous Workflow: PR Triage & Improvement

This example demonstrates a complete, autonomous workflow that uses tools from both servers. An engineering team wants to automate the initial triage of pull requests from open-source contributors. This workflow will automatically review the PR, use Jules to improve it, and then post a comment with a link to the improved version.

This entire process is kicked off by a single slash command.

### 1. The Slash Command (`/triage-pr`)

First, we create a slash command in Claude Code that takes a PR URL as an argument and invokes our specialized subagent.

**File:** `.claude/commands/triage-pr.md`

```markdown
---
name: triage-pr
description: 'Kicks off the autonomous triage process for a pull request.'
arguments:
  - The URL of the pull request to triage.
---

Please use the **@pr-triager** to triage and improve the PR at the following URL:

$ARGUMENTS
```

### 2. The Subagent (`@pr-triager`)

This is the orchestrator. It's a specialized agent whose only job is to follow a precise workflow using a combination of `github` and `jules` tools.

**File:** `.claude/agents/pr-triager.md`

````markdown
---
name: pr-triager
description: 'An expert at triaging and improving pull requests using a combination of GitHub and Jules tools.'
---

You are an autonomous PR triage agent. Your goal is to take a PR from a contributor, use Jules to improve it, and post a comment on the original PR with a link to Jules's improved version.

**Your workflow is as follows. Follow it precisely.**

1.  **Get PR Details:** The user will provide a PR URL. Use the `github_get_pr_details` tool to fetch the PR's description, author, and, most importantly, the code diff.

2.  **Create a Jules Session:** Use the `jules_create_session` tool to start an automated run. The prompt for Jules _must_ include the full diff from the previous step. The prompt template is:

    > "Please review the following code diff from a contributor's pull request.
    >
    > **Your Task:**
    >
    > 1. If there are obvious bugs, fix them.
    > 2. If the test coverage is insufficient, add new tests.
    > 3. If the code quality is poor (e.g., bad variable names, complex logic), refactor it for clarity and maintainability.
    > 4. Produce a new, improved pull request with your changes.
    >
    > **Original PR Diff:**
    >
    > ````diff
    > {INSERT_DIFF_HERE}
    > ```"
    > ````

3.  **Monitor the Jules Session:** After creating the session, use the `jules_session_state` tool to periodically check its status. Wait until the `state` is `completed`.

4.  **Post the Result:** Once the Jules session is complete, the `jules_session_state` tool will return the URL of the new, improved pull request created by Jules. Use the `github_comment_on_pr` tool to post a comment back to the _original_ pull request. The comment template is:
    > "Thank you for your contribution! Our automated agent, Jules, has reviewed your PR and created an improved version with additional tests and refactoring. The team will review this new version for merging.
    >
    > **Improved PR:** {INSERT_JULES_PR_URL_HERE}"
````

### 3. The Result

Now, a developer can kick off this entire, complex workflow with a single command:

> **/triage-pr** https://github.com/my-org/my-repo/pull/123

The assistant will invoke the subagent, which will then seamlessly orchestrate the `github` and `jules` tools, bridging the gap between repository management and code generation to create a fully autonomous process.
