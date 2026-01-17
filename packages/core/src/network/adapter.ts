import { ApiClient } from '../api.js';
import { JulesApiError } from '../errors.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';
import { mapRestActivityToSdkActivity } from '../mappers.js';

import { Platform } from '../platform/types.js';

// Helper for delays
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Concrete implementation of NetworkClient that communicates with the Jules API.
 * Handles fetching activities and streaming them via polling.
 */
export class NetworkAdapter implements NetworkClient {
  // Track if this is the first request to this session, for 404 retry logic
  private isFirstRequest = true;

  constructor(
    private apiClient: ApiClient,
    private sessionId: string,
    private pollingIntervalMs: number = 5000,
    private platform: Platform,
  ) {}

  /**
   * Fetches a single activity from the API.
   */
  async fetchActivity(activityId: string): Promise<Activity> {
    const restActivity = await this.apiClient.request<any>(
      `sessions/${this.sessionId}/activities/${activityId}`,
    );
    return mapRestActivityToSdkActivity(restActivity, this.platform);
  }

  /**
   * Lists activities from the API with pagination.
   * Includes retry logic for 404 errors on the first request to handle
   * eventual consistency issues when a session is newly created.
   */
  async listActivities(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }> {
    const params: Record<string, string> = {};
    if (options?.pageSize) {
      params.pageSize = options.pageSize.toString();
    }
    if (options?.pageToken) {
      params.pageToken = options.pageToken;
    }
    if (options?.filter) {
      params.filter = options.filter;
    }

    const endpoint = `sessions/${this.sessionId}/activities`;

    // First request retry logic for 404 (eventual consistency)
    if (this.isFirstRequest) {
      try {
        const response = await this._fetchActivities(endpoint, params);
        this.isFirstRequest = false;
        return response;
      } catch (error) {
        if (error instanceof JulesApiError && error.status === 404) {
          // Retry with exponential backoff
          let lastError: JulesApiError = error;
          let delay = 1000; // Start with 1 second

          for (let attempt = 0; attempt < 5; attempt++) {
            await sleep(delay);
            delay *= 2; // Double for next attempt (1s, 2s, 4s, 8s, 16s)

            try {
              const response = await this._fetchActivities(endpoint, params);
              this.isFirstRequest = false;
              return response;
            } catch (retryError) {
              if (
                retryError instanceof JulesApiError &&
                retryError.status === 404
              ) {
                lastError = retryError;
                // Continue retrying
              } else {
                throw retryError; // Non-404 error, throw immediately
              }
            }
          }

          throw lastError; // All retries exhausted
        }
        throw error; // Non-404 on first attempt
      }
    }

    // Subsequent requests: no retry
    this.isFirstRequest = false;
    return this._fetchActivities(endpoint, params);
  }

  /**
   * Internal helper to fetch activities from the API.
   */
  private async _fetchActivities(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }> {
    const response = await this.apiClient.request<{
      activities?: any[];
      nextPageToken?: string;
    }>(endpoint, { query: params });

    return {
      activities: (response.activities || []).map((activity) =>
        mapRestActivityToSdkActivity(activity, this.platform),
      ),
      nextPageToken: response.nextPageToken,
    };
  }

  /**
   * Polls the API for new activities and yields them.
   * This stream never ends unless the process is terminated.
   */
  async *rawStream(): AsyncIterable<Activity> {
    while (true) {
      let pageToken: string | undefined = undefined;

      do {
        const response = await this.listActivities({ pageToken });

        for (const activity of response.activities) {
          yield activity;
        }

        pageToken = response.nextPageToken;
      } while (pageToken);

      await this.platform.sleep(this.pollingIntervalMs);
    }
  }
}
