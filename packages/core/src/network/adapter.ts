import { ApiClient } from '../api.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';
import { mapRestActivityToSdkActivity } from '../mappers.js';

import { Platform } from '../platform/types.js';

/**
 * Concrete implementation of NetworkClient that communicates with the Jules API.
 * Handles fetching activities and streaming them via polling.
 */
export class NetworkAdapter implements NetworkClient {
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

    const response = await this.apiClient.request<{
      activities?: any[];
      nextPageToken?: string;
    }>(`sessions/${this.sessionId}/activities`, { query: params });

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
