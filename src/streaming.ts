// src/streaming.ts
import { ApiClient } from './api.js';
import { mapRestActivityToSdkActivity } from './mappers.js';
import { Activity } from './types.js';

// Define the raw REST API response type for listing activities.
type ListActivitiesResponse = {
  activities: any[]; // Using any for now, will be mapped.
  nextPageToken?: string;
};

// A helper function for delaying execution.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * An async generator that implements a hybrid pagination/polling strategy
 * to stream activities for a given session.
 *
 * @param sessionId The ID of the session to stream activities for.
 * @param apiClient The API client to use for requests.
 * @param pollingInterval The time in milliseconds to wait before polling for new activities.
 * @internal
 */
export async function* streamActivities(
  sessionId: string,
  apiClient: ApiClient,
  pollingInterval: number,
): AsyncGenerator<Activity> {
  let pageToken: string | undefined = undefined;

  while (true) {
    const response: ListActivitiesResponse = await apiClient.request<ListActivitiesResponse>(
      `sessions/${sessionId}/activities`,
      {
        params: {
          pageSize: '50', // A reasonable page size
          ...(pageToken ? { pageToken } : {}),
        },
      },
    );

    const activities = response.activities || [];
    let hasTerminalActivity = false;

    for (const rawActivity of activities) {
      const activity = mapRestActivityToSdkActivity(rawActivity);
      yield activity;

      if (activity.type === 'sessionCompleted' || activity.type === 'sessionFailed') {
        hasTerminalActivity = true;
      }
    }

    if (hasTerminalActivity) {
      return; // End the stream.
    }

    if (response.nextPageToken) {
      pageToken = response.nextPageToken;
      // Immediately fetch the next page without waiting.
      continue;
    } else {
      // We've reached the end of the current stream, so wait before polling again.
      pageToken = undefined; // Reset for the next poll
      await sleep(pollingInterval);
    }
  }
}
