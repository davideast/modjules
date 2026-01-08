import type { VerifyCallback, Identity } from './types.js';

export interface FirebaseRestConfig {
  apiKey: string; // Firebase Web API Key
}

/**
 * Strategy: Firebase REST (Portable: GAS, Cloudflare, etc.)
 * Uses the Google Identity Toolkit API via platform.fetch().
 */
export function verifyFirebaseRest(config: FirebaseRestConfig): VerifyCallback {
  return async (token, platform) => {
    if (!config.apiKey)
      throw new Error("Strategy Config Error: 'apiKey' is missing");
    if (!token) throw new Error('Unauthorized: Auth token is missing');

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`;

    // Use the injected platform's fetch implementation
    const res = await platform.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Throw a specific error for better debugging
      throw new Error(`Firebase Auth Failed: ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as any;
    if (!data.users || data.users.length === 0) {
      throw new Error('Invalid Token: User not found');
    }

    const user = data.users[0];
    return { uid: user.localId, email: user.email } as Identity;
  };
}
