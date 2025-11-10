import { setTimeout } from 'timers/promises';
import { ApiClient } from '../api.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';

export class NetworkAdapter implements NetworkClient {
  constructor(
    private apiClient: ApiClient,
    private sessionId: string,
    private pollingIntervalMs: number = 5000,
  ) {}

  async fetchActivity(activityId: string): Promise<Activity> {
    return this.apiClient.request<Activity>(
      `sessions/${this.sessionId}/activities/${activityId}`,
    );
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
      activities?: Activity[];
      nextPageToken?: string;
    }>(`sessions/${this.sessionId}/activities`, { params });

    return {
      activities: response.activities || [],
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
