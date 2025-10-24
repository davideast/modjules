// src/streaming.ts
import { ApiClient } from './api.js';
import { JulesApiError } from './errors.js';
import { mapRestActivityToSdkActivity } from './mappers.js';
import { Activity, SessionResource } from './types.js';

// A helper function for delaying execution.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Define the raw REST API response type for listing activities.
type ListActivitiesResponse = {
  activities: any[]; // Using any for now, will be mapped.
  nextPageToken?: string;
};

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
  let isFirstCall = true;

  while (true) {
    let response: ListActivitiesResponse;
    try {
      response = await apiClient.request<ListActivitiesResponse>(
        `sessions/${sessionId}/activities`,
        {
          params: {
            pageSize: '50', // A reasonable page size
            ...(pageToken ? { pageToken } : {}),
          },
        },
      );
    } catch (error) {
      if (
        isFirstCall &&
        error instanceof JulesApiError &&
        error.status === 404
      ) {
        let lastError: JulesApiError = error;
        let successfulResponse: ListActivitiesResponse | undefined;
        let delay = 1000; // Start with a 1-second delay

        for (let i = 0; i < 5; i++) {
          await sleep(delay);
          delay *= 2; // Double the delay for the next attempt
          try {
            successfulResponse =
              await apiClient.request<ListActivitiesResponse>(
                `sessions/${sessionId}/activities`,
                {
                  params: {
                    pageSize: '50',
                    ...(pageToken ? { pageToken } : {}),
                  },
                },
              );
            break; // On success, exit the retry loop.
          } catch (retryError) {
            if (
              retryError instanceof JulesApiError &&
              retryError.status === 404
            ) {
              lastError = retryError;
            } else {
              throw retryError; // Re-throw non-404 errors immediately.
            }
          }
        }

        if (successfulResponse) {
          response = successfulResponse;
        } else {
          throw lastError; // If all retries fail, throw the last 404 error.
        }
      } else {
        throw error; // Re-throw non-retryable errors.
      }
    }

    isFirstCall = false; // Mark the first call as done.

    const activities = response.activities || [];
    let hasTerminalActivity = false;

    for (const rawActivity of activities) {
      const activity = mapRestActivityToSdkActivity(rawActivity);
      yield activity;

      if (
        activity.type === 'sessionCompleted' ||
        activity.type === 'sessionFailed'
      ) {
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
