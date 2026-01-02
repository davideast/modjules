// tests/mocks/sync.ts
import { ApiClient } from '../../src/api.js';
import { SessionResource, Activity } from '../../src/types.js';

export function mockSession(props: Partial<SessionResource>): SessionResource {
  const id = props.id || 'test-session';
  return {
    id,
    name: `sessions/${id}`,
    state: 'inProgress',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    prompt: 'Test Prompt',
    sourceContext: { source: 'github/test/repo' },
    title: 'Test Session',
    url: '',
    outputs: [],
    ...props,
  };
}

type MockRequest = {
  pattern: string | RegExp;
  data: any;
};

export function mock(requests: MockRequest[]): ApiClient {
  const apiClient = new ApiClient({
    apiKey: 'test',
    baseUrl: 'https://api.jules.ai/v1alpha',
    requestTimeoutMs: 30000,
  });
  apiClient.request = async <T>(path: string): Promise<T> => {
    const match = requests.find((r) => path.match(r.pattern));
    if (match) {
      return match.data as T;
    }
    throw new Error(`[Mock API] Unhandled request: ${path}`);
  };
  return apiClient;
}
