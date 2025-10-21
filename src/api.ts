// src/api.ts

/**
 * A custom error class for all SDK-specific errors.
 */
export class JulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JulesError';
  }
}

/**
 * An error class representing a failed API response.
 */
export class JulesApiError extends JulesError {
    public readonly status: number;
    public readonly statusText: string;

    constructor(message: string, status: number, statusText: string) {
        super(message);
        this.name = 'JulesApiError';
        this.status = status;
        this.statusText = statusText;
    }
}

/**
 * Thrown when an API key is required but not provided.
 */
export class MissingApiKeyError extends JulesError {
  constructor() {
    super(
      'Jules API key is missing. Pass it to the constructor or set the JULES_API_KEY environment variable.'
    );
    this.name = 'MissingApiKeyError';
  }
}

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
