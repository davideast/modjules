import { VerifyCallback, Identity } from '../../server/types.js';

type AllowListChecker = (identity: Identity) => Promise<boolean>;

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
    const identityOrUid = await strategy(token, platform);
    let identity: Identity;
    if (typeof identityOrUid === 'string') {
      identity = { uid: identityOrUid };
    } else {
      identity = identityOrUid;
    }

    // 2. Normalize Identity
    const idObj = identity;

    // 3. Check Allow List
    let isAllowed = false;
    if (Array.isArray(allowed)) {
      const identifier = idObj.email || idObj.uid;
      isAllowed = allowed.includes(identifier);
    } else {
      isAllowed = await allowed(idObj);
    }

    if (!isAllowed) {
      throw new Error(
        `Access Denied: ${idObj.email || idObj.uid} is not on the allow list.`,
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
