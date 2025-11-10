import { setTimeout } from 'timers/promises';
import { ApiClient } from '../api.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';
import { mapRestActivityToSdkActivity } from '../mappers.js';

export class NetworkAdapter implements NetworkClient {
  constructor(
    private apiClient: ApiClient,
    private sessionId: string,
    private pollingIntervalMs: number = 5000,
  ) {}

  async fetchActivity(activityId: string): Promise<Activity> {
    const restActivity = await this.apiClient.request<any>(
      `sessions/${this.sessionId}/activities/${activityId}`,
    );
    return mapRestActivityToSdkActivity(restActivity);
  }

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

    const response = await this.apiClient.request<{
      activities?: any[];
      nextPageToken?: string;
    }>(`sessions/${this.sessionId}/activities`, { params });

    return {
      activities: (response.activities || []).map(mapRestActivityToSdkActivity),
      nextPageToken: response.nextPageToken,
    };
  }

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

      await setTimeout(this.pollingIntervalMs);
    }
  }
}
