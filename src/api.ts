// src/api.ts

import { JulesApiError, MissingApiKeyError } from './errors.js';

export type ApiClientOptions = {
  apiKey: string | undefined;
  baseUrl: string;
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

  constructor(options: ApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
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

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new JulesApiError(
        `API request failed with status ${response.status}: ${errorBody}`,
        response.status,
        response.statusText
      );
    }

    // Handle cases where the response body might be empty
    const responseText = await response.text();
    if (!responseText) {
      return {} as T;
    }

    return JSON.parse(responseText) as T;
  }
}
