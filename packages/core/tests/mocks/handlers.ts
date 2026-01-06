// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

const API_KEY = 'test-api-key';
const BASE_URL = 'https://jules.googleapis.com/v1alpha';

export const handlers = [
  // Handler for listing sources (single page)
  http.get(`${BASE_URL}/sources`, ({ request }) => {
    const url = new URL(request.url);
    const pageToken = url.searchParams.get('pageToken');

    if (request.headers.get('X-Goog-Api-Key') !== API_KEY) {
      return new HttpResponse('Unauthorized', { status: 401 });
    }

    if (pageToken) {
      // Second page of results
      return HttpResponse.json({
        sources: [
          {
            name: 'sources/github/another/repo',
            id: 'github/another/repo',
            githubRepo: {
              owner: 'another',
              repo: 'repo',
              isPrivate: false,
            },
          },
        ],
      });
    }

    // First page of results
    return HttpResponse.json({
      sources: [
        {
          name: 'sources/github/davideast/dataprompt',
          id: 'davideast/dataprompt',
          githubRepo: {
            owner: 'davideast',
            repo: 'dataprompt',
            isPrivate: false,
          },
        },
      ],
      nextPageToken: 'page-2-token',
    });
  }),

  // Handler for getting a specific source
  http.get(`${BASE_URL}/sources/github/:owner/:repo`, ({ request, params }) => {
    const { owner, repo } = params;

    if (request.headers.get('X-Goog-Api-Key') !== API_KEY) {
      return new HttpResponse('Unauthorized', { status: 401 });
    }

    if (owner === 'davideast' && repo === 'dataprompt') {
      return HttpResponse.json({
        name: `sources/github/davideast/dataprompt`,
        id: `davideast/dataprompt`,
        githubRepo: {
          owner: 'davideast',
          repo: 'dataprompt',
          isPrivate: false,
        },
      });
    }

    if (owner === 'non' && repo === 'existent') {
      return new HttpResponse('Not Found', { status: 404 });
    }

    // For any other case, return a generic error
    return new HttpResponse('Internal Server Error', { status: 500 });
  }),

  // Handler for creating a session
  http.post(`${BASE_URL}/sessions`, () => {
    // This default handler can be overridden in specific tests
    return HttpResponse.json({
      name: 'sessions/default-session-id',
      id: 'default-session-id',
      state: 'queued',
    });
  }),

  // Handler for getting a session (polling)
  http.get(`${BASE_URL}/sessions/:sessionId`, ({ params }) => {
    const { sessionId } = params;
    // This default handler returns a completed state, can be overridden
    return HttpResponse.json({
      name: `sessions/${sessionId}`,
      id: sessionId,
      state: 'completed',
      outputs: [],
    });
  }),
];
