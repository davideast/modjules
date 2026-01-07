# MCP Server Configuration

The `modjules` MCP server allows you to use Jules as a tool within any Model Context Protocol (MCP) compatible client, such as Claude Code, Gemini CLI, Cursor, and various VS Code extensions.

This guide provides the copy-pasteable configuration you need to get started.

## Quick Start

### Claude Code

```bash
npx @modjules/mcp@next config --key "YOUR_JULES_API_KEY"
claude mcp add modjules -- npx @modjules/mcp@next
```

### Gemini CLI

```bash
npx @modjules/mcp@next config --key "YOUR_JULES_API_KEY"
gemini mcp add modjules -- npx @modjules/mcp@next
```

## How it Works

MCP clients discover available tools by reading a local configuration file, typically located at `~/.mcp.json` or a project-specific `.mcp.json`. You add a server definition to this file that tells the client how to start the `modjules` server.

The server runs as a local background process on your machine, and the client communicates with it over standard input/output.

## Step-by-Step Configuration

### Step 1: Configure your API Key

Before adding the MCP server, save your Jules API key using the built-in config command:

```bash
npx @modjules/mcp@next config --key "YOUR_JULES_API_KEY"
```

This stores your key locally at `~/.config/modjules/config.json`, so you don't need to include it in environment variables.

You can find your API key in your [Jules account settings](https://jules.google.com).

### Step 2: Add to your MCP configuration file

Open your client's MCP configuration file and add the following:

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "@modjules/mcp@next"]
    }
  }
}
```

> **Note:** The `@next` tag gives you the latest beta features. Once stable, you can remove `@next` to use the stable release.

### Alternative: Using Environment Variables

If you prefer to pass the API key via environment variable instead of using `config`:

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "@modjules/mcp@next"],
      "env": {
        "JULES_API_KEY": "<YOUR_API_KEY_HERE>"
      }
    }
  }
}
```

### Client-Specific Instructions

- **Claude Code:**
  - Use the one-liner: `claude mcp add modjules -- npx @modjules/mcp@next`
  - Or manually add to `~/.claude/claude_desktop_config.json`

- **Gemini CLI:**
  - Use the one-liner: `gemini mcp add modjules -- npx @modjules/mcp@next`
  - Or manually add to `~/.config/gemini/settings.json`

- **Cursor:**
  - Create a file named `.mcp.json` at the root of your project folder.
  - Add the configuration above. Cursor will automatically detect the server when you open the project.

- **Other MCP Clients:**
  - Consult your client's documentation for the exact location of the MCP configuration file, but the JSON structure should be the same.

## Local Development Configuration

If you are developing `modjules` locally and want to use your local build of the MCP server, you can point the command to your `dist` folder.

```json
{
  "mcpServers": {
    "modjules-local": {
      "command": "node",
      "args": ["/path/to/your/modjules/packages/mcp/dist/cli.mjs"]
    }
  }
}
```

Make sure you've configured your API key first:

```bash
node /path/to/your/modjules/packages/mcp/dist/cli.mjs config --key "YOUR_JULES_API_KEY"
```

## Verify Installation

After adding the configuration, restart your MCP client. You can verify the server is working by running:

```bash
npx @modjules/mcp@next doctor
```

You should see all checks pass, and the `jules_*` tools should be available in your client's tool palette.
