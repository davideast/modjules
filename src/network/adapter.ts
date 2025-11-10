import { ApiClient } from '../api.js';
import { NetworkClient } from '../activities/client.js';
import { Activity } from '../types.js';
import { ListOptions } from '../activities/types.js';

export class NetworkAdapter implements NetworkClient {
  constructor(
    private apiClient: ApiClient,
    private sessionId: string,
    private pollingIntervalMs: number = 2000,
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

    return this.apiClient.request<{
      activities: Activity[];
      nextPageToken?: string;
    }>(`sessions/${this.sessionId}/activities`, { params });
  }

  async *rawStream(): AsyncIterable<Activity> {
    let currentToken: string | undefined;

    while (true) {
      const response = await this.listActivities({ pageToken: currentToken });

      if (response.activities) {
        for (const activity of response.activities) {
          yield activity;
        }
      }

      if (response.nextPageToken) {
        currentToken = response.nextPageToken;
      } else {
        // End of list reached. Wait and restart from scratch.
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollingIntervalMs),
        );
        currentToken = undefined;
      }
    }
  }
}
