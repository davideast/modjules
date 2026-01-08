# MCP Server Configuration

The `modjules` MCP server allows you to use Jules as a tool within any Model Context Protocol (MCP) compatible client, such as Antigravity (in Google's Gemini), Cursor, and various VS Code extensions.

This guide provides the copy-pasteable configuration you need to get started.

## How it Works

MCP clients discover available tools by reading a local configuration file, typically located at `~/.mcp.json` or a project-specific `.mcp.json`. You add a server definition to this file that tells the client how to start the `modjules` server.

The server runs as a local background process on your machine, and the client communicates with it over standard input/output.

## Universal Configuration

This configuration is the recommended setup and works for most clients. It uses `npx` to automatically download and run the latest version of the `@modjules/mcp` package.

**1. Find your `JULES_API_KEY`**

You can find this in your Jules account settings.

**2. Add to your MCP configuration file**

Open your client's MCP configuration file (e.g., `~/.mcp.json` for Antigravity, or your project's `.mcp.json` for Cursor) and add the following JSON object to the `mcpServers` dictionary.

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "@modjules/mcp"],
      "env": {
        "JULES_API_KEY": "<YOUR_API_KEY_HERE>"
      }
    }
  }
}
```

### Client-Specific Instructions

- **Antigravity / Google Gemini:**
  - Create or edit the file at `~/.config/mcp.json`.
  - Add the `jules` server definition to the `mcpServers` object.

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
    "jules-local-dev": {
      "command": "node",
      "args": ["/path/to/your/modjules/packages/mcp/dist/cli.mjs"],
      "env": {
        "JULES_API_KEY": "<YOUR_API_KEY_HERE>"
      }
    }
  }
}
```

After adding the configuration, restart your MCP client. You should now see the `jules_*` tools available in your tool palette.
