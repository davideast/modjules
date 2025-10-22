// src/api.ts

import {
  JulesApiError,
  JulesAuthenticationError,
  JulesNetworkError,
  JulesRateLimitError,
  MissingApiKeyError,
} from './errors.js';

export type ApiClientOptions = {
  apiKey: string | undefined;
  baseUrl: string;
  requestTimeoutMs: number;
};

export type ApiRequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
};

/**
 * A simple internal API client to handle HTTP requests to the Jules API.
 * @internal
 */
export class ApiClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.requestTimeoutMs = options.requestTimeoutMs;
  }

  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new MissingApiKeyError();
    }

    const { method = 'GET', body, params } = options;
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'X-Goog-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      // This catches fetch failures (e.g., network error, DNS resolution failure)
      // and timeouts from the AbortController.
      throw new JulesNetworkError(`API request failed: ${(error as Error).message}`, {
        cause: error as Error,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      const message = `API request failed with status ${response.status}: ${errorBody}`;

      switch (response.status) {
        case 401:
        case 403:
          throw new JulesAuthenticationError(response.status, response.statusText);
        case 429:
          throw new JulesRateLimitError(response.status, response.statusText);
        default:
          throw new JulesApiError(
            message,
            response.status,
            response.statusText,
          );
      }
    }

    const responseText = await response.text();
    if (!responseText) {
      return {} as T;
    }

    return JSON.parse(responseText) as T;
  }
}
