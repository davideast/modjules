import { Jules } from '../../src/index.js';
import { describe, it, expect } from 'vitest';

const API_KEY = process.env.JULES_API_KEY;

describe.skipIf(!API_KEY)('Live API Tests', () => {
  const jules = new Jules({ apiKey: API_KEY });
  const knownSessionId = '14206685469638205429';

  it('should rehydrate a session and fetch its info', async () => {
    const session = jules.session(knownSessionId);
    const info = await session.info();

    expect(info).toBeDefined();
    expect(info.id).toBe(knownSessionId);
    expect(info.name).toBe(`sessions/${knownSessionId}`);
  }, 30000);

  it('should stream activities from a rehydrated session', async () => {
    const session = jules.session(knownSessionId);
    const stream = session.stream();
    const { value: firstActivity } = await stream.next();

    expect(firstActivity).toBeDefined();
    expect(firstActivity.sessionId).toBe(knownSessionId);
  }, 30000);
});
