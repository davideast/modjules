import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ListToolsResult,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Configuration for the Jules MCP Client.
 */
export interface JulesMCPConfig {
  /**
   * The API key used for authentication.
   * If not provided, will look for JULES_API_KEY environment variable.
   */
  apiKey?: string;
  /**
   * The base URL for the Jules MCP server.
   * Defaults to 'https://jules.googleapis.com/mcp' (Placeholder, adjust as needed).
   */
  baseUrl?: string;
  /**
   * Timeout for requests in milliseconds.
   * @default 300_000 (5 minutes)
   */
  timeout?: number;
}

/**
 * A robust, authenticated driver for the Jules MCP Server.
 * Handles auth injection and transport negotiation.
 */
export class JulesMCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: Required<JulesMCPConfig>;
  private isConnected: boolean = false;

  constructor(config?: JulesMCPConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.JULES_API_KEY || '',
      baseUrl: config?.baseUrl || 'https://jules.googleapis.com/mcp',
      timeout: config?.timeout || 300_000,
    };

    if (!this.config.apiKey) {
      throw new Error("JulesMCPClient requires 'apiKey'.");
    }

    this.client = new Client(
      { name: 'jules-client', version: '1.0.0' },
      { capabilities: {} },
    );
  }

  /**
   * Monkey-patches global fetch to ensure headers are ALWAYS present.
   */
  private installNetworkInterceptor() {
    const originalFetch = globalThis.fetch;
    if ((originalFetch as any).__julesMcpPatched) return;

    (globalThis as any).fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      let url = input.toString();
      if (input instanceof Request) url = input.url;

      // Only intercept Jules MCP calls
      if (url.startsWith(this.config.baseUrl)) {
        const newHeaders = new Headers(init?.headers);
        newHeaders.set('X-Goog-Api-Key', this.config.apiKey);
        // Also support Bearer token if API key is not sufficient or different auth scheme is used
        // But for now, mimicking Jules SDK which uses X-Goog-Api-Key

        // Ensure Content-Type for POST
        if (
          !newHeaders.has('Content-Type') &&
          (init?.method === 'POST' ||
            (input instanceof Request && input.method === 'POST'))
        ) {
          newHeaders.set('Content-Type', 'application/json');
        }

        const newInit: RequestInit = { ...init, headers: newHeaders };

        // Preserve method if it was in the Request object but not in init
        if (input instanceof Request && !newInit.method) {
          newInit.method = input.method;
        }

        return originalFetch(url, newInit);
      }
      return originalFetch(input, init);
    };
    (globalThis.fetch as any).__julesMcpPatched = true;
  }

  async connect() {
    if (this.isConnected) return;

    this.installNetworkInterceptor();

    // Transport gets the URL; headers are handled by interceptor
    this.transport = new StreamableHTTPClientTransport(
      new URL(this.config.baseUrl),
    );

    this.transport.onerror = (err) => {
      console.error('Jules MCP Transport Error:', err);
      this.isConnected = false;
    };

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  /**
   * Generic tool caller with type support and error parsing.
   */
  async callTool<T>(name: string, args: Record<string, any>): Promise<T> {
    if (!this.isConnected) await this.connect();

    const result = await this.client.callTool(
      { name, arguments: args },
      undefined,
      { timeout: this.config.timeout },
    );

    if (result.isError) {
      const errorText = (result.content as any[])
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('');
      throw new Error(`Tool Call Failed [${name}]: ${errorText}`);
    }

    // Check structuredContent first, then JSON in text
    // Note: The SDK types might not strictly match the dynamic nature of MCP responses in all cases
    const anyResult = result as any;
    if (anyResult.structuredContent) return anyResult.structuredContent as T;

    const textContent = (result.content as any[]).find(
      (c) => c.type === 'text',
    );
    if (textContent && textContent.type === 'text') {
      try {
        return JSON.parse(textContent.text) as T;
      } catch {
        return textContent.text as unknown as T;
      }
    }

    return anyResult as T;
  }

  async getCapabilities(): Promise<ListToolsResult> {
    if (!this.isConnected) await this.connect();
    return this.client.listTools();
  }

  async close() {
    if (this.transport) {
      await this.transport.close();
      this.isConnected = false;
    }
  }
}
