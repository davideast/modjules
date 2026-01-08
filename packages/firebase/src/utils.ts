import { VerifyCallback, Identity, AllowListChecker } from './types.js';

/**
 * Wraps a strategy and restricts access based on an allow list.
 * Supports static arrays OR async lookup functions.
 */
export function withAllowList(
  allowed: string[] | AllowListChecker,
  strategy: VerifyCallback,
): VerifyCallback {
  return async (token, platform) => {
    // 1. Verify Token
    const identityResult = await strategy(token, platform);
    const identity: Identity =
      typeof identityResult === 'string'
        ? { uid: identityResult }
        : identityResult;

    // 2. Check Allow List
    let isAllowed = false;
    if (Array.isArray(allowed)) {
      const identifier = identity.email || identity.uid;
      isAllowed = allowed.includes(identifier);
    } else {
      isAllowed = await allowed(identity);
    }

    if (!isAllowed) {
      throw new Error(
        `Access Denied: ${identity.email || identity.uid} is not on the allow list.`,
      );
    }

    return identity;
  };
}

/**
 * Normalizes an email for use as a database key.
 */
export function normalizeEmailKey(
  email: string,
  platform: 'rtdb' | 'firestore',
): string {
  if (!email) throw new Error('Email is required');
  // RTDB: Replace '.' with ','
  if (platform === 'rtdb') return email.replace(/\./g, ',');
  // Firestore: Return as-is (supports dots in doc IDs)
  return email;
}
