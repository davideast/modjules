import type { Identity, VerifyCallback } from '@modjules/auth';

export type AllowListChecker = (identity: Identity) => Promise<boolean>;
export { Identity, VerifyCallback };
