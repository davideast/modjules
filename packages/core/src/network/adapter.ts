import { ApiClient } from '../api.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';
import { mapRestActivityToSdkActivity } from '../mappers.js';
import { withFirstRequestRetry } from '../retry-utils.js';

import { Platform } from '../platform/types.js';

/**
 * Concrete implementation of NetworkClient that communicates with the Jules API.
 * Handles fetching activities and streaming them via polling.
 *
 * Includes automatic 404 retry logic for the first request to handle eventual
 * consistency issues when a session is newly created.
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
   * Includes 404 retry logic on first request for eventual consistency.
   */
  async fetchActivity(activityId: string): Promise<Activity> {
    const endpoint = `sessions/${this.sessionId}/activities/${activityId}`;

    const fetch = async () => {
      const restActivity = await this.apiClient.request<any>(endpoint);
      return mapRestActivityToSdkActivity(restActivity, this.platform);
    };

    // Apply retry logic only on first request
    if (this.isFirstRequest) {
      const result = await withFirstRequestRetry(fetch);
      this.isFirstRequest = false;
      return result;
    }

    return fetch();
  }

  /**
   * Lists activities from the API with pagination.
   * Includes 404 retry logic on first request for eventual consistency.
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

    const fetch = async () => {
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
    };

    // Apply retry logic only on first request
    if (this.isFirstRequest) {
      const result = await withFirstRequestRetry(fetch);
      this.isFirstRequest = false;
      return result;
    }

    return fetch();
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
