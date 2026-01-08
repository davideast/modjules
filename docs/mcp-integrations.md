# MCP Server Integrations

The `modjules` MCP server allows you to integrate Jules directly into your AI-native development workflow. This guide provides practical recipes for creating custom commands, workflows, and subagents in popular clients like Claude Code, Antigravity, and the Gemini CLI.

## Claude Code: Slash Commands

Slash commands in Claude Code are a powerful way to create reusable, parameterized prompts. They are defined as simple Markdown files in a special directory.

### Example: `/jules-refactor` Command

This command allows a developer to quickly kick off a Jules refactoring session on the current branch.

**1. Create the command file**

Create a file at `.claude/commands/jules-refactor.md` in your project's root directory.

```markdown
---
name: jules-refactor
description: 'Starts a Jules session to refactor the specified part of the codebase.'
arguments:
  - The refactoring prompt (e.g., "Refactor the auth service to use the new DI pattern")
---

Please create a new Jules session with the following prompt, targeting the current git branch:

"$ARGUMENTS"
```

**2. Use the command**

Now, in the Claude Code chat, you can type `/` to see your new command.

> **/jules-refactor** Refactor the auth service to use the new DI pattern

This will trigger the assistant to call the `jules_create_session` tool with your prompt, automatically providing the correct repository and branch from its context.

## Claude Code: Subagents

Subagents are specialized agents that your main agent can invoke to perform complex, multi-step tasks. You can create a subagent that is an expert at using the Jules tools for a specific workflow, like code review.

### Example: `jules-reviewer` Subagent

This subagent's sole job is to use the Jules MCP tools to review the code changes in a given session.

**1. Create the subagent file**

Create a file at `.claude/agents/jules-reviewer.md`.

```markdown
---
name: jules-reviewer
description: 'An expert at reviewing the code changes in a Jules session. Give it a session ID.'
---

You are a senior code reviewer. Your only goal is to review the code changes in the provided Jules session.

**Your workflow:**

1.  Use the `jules_session_files` tool to see a list of all files that were changed in the session.
2.  For each modified file, use the `jules_get_code_changes` tool to get the detailed diff.
3.  Analyze all the diffs for potential bugs, style issues, or security vulnerabilities.
4.  Provide a concise, summary code review back to the user. Do not suggest changes, only report your findings.
```

**2. Use the subagent**

Now, you can invoke your subagent from your main chat.

> **Prompt:** "Use the **@jules-reviewer** to review session 12345."

The main agent will delegate the entire task to your subagent, which will then execute its specialized workflow of calling `jules_session_files`, looping through the results, calling `jules_get_code_changes` for each file, and finally providing a summary.

## Antigravity: Workflows

Antigravity workflows are defined by chaining MCP tools together using natural language prompts, often guided by instructions in an `AGENTS.md` file.

### Example: Bug Reproduction Workflow

You can instruct Antigravity to use Jules for its bug reproduction workflow by creating an `AGENTS.md` file in your project root.

```markdown
You are an expert at bug reproduction. When a user gives you a bug report, your goal is to create a pull request with a failing test.

**Your workflow:**

1.  Read the user's bug report carefully.
2.  Use the `jules_create_session` tool to start a new Jules run. The prompt should instruct Jules to write a single failing test that reproduces the bug.
3.  After creating the session, use the `jules_session_state` tool periodically to check on the status.
4.  Once the session is complete and a pull request has been created, provide the URL of the pull request to the user.
```

Now, when you're in Antigravity, you can simply provide a bug report and the agent will follow your prescribed workflow.

> **Prompt:** "The login button is disabled on mobile when the user has 2FA enabled."

The agent will read your `AGENTS.md` file and execute the steps, calling `jules_create_session` and then `jules_session_state` until it can provide the final PR.

## Gemini CLI / Generic CLIs

While the Gemini CLI supports file-based commands similar to Claude Code, a more universal pattern for any CLI is to create a simple shell script that wraps a common toolchain.

### Example: `jules-review` Shell Script

This script allows you to quickly get a summary of all changes in a session directly from your terminal.

**1. Create the script**

Create a file named `jules-review` somewhere in your `$PATH`.

```bash
#!/bin/bash

SESSION_ID=$1

if [ -z "$SESSION_ID" ]; then
  echo "Usage: jules-review <session-id>"
  exit 1
fi

echo "Fetching changed files for session $SESSION_ID..."

# Use Gemini to call the tool and get the result
# The 'gemini' command here could be any MCP-compatible CLI
gemini "Please call the jules_session_files tool for session $SESSION_ID and show me only the raw JSON output."
```

**2. Use the script**

Now you have a simple, reusable command for your terminal workflow.

> **$ jules-review 12345**
> Fetching changed files for session 12345...
> (The script then prints the JSON output from the `jules_session_files` tool)

You could extend this script to loop through the files and call `jules_get_code_changes` for each one, creating a powerful, custom review tool right in your shell.
