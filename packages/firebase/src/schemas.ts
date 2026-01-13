// packages/firebase/src/schemas.ts
import { z } from 'zod';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { ServerConfig } from '@modjules/server';

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ApiKeySchema = z
  .string()
  .min(10, 'API key must be at least 10 characters')
  .optional(); // Optional because it might come from ENV

const CollectionNameSchema = z
  .string()
  .min(1, 'Collection name cannot be empty')
  .regex(/^[a-zA-Z0-9_/-]+$/, 'Invalid collection name characters')
  .default('sessions');

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const FirebaseInputSchema = z.object({
  /** Jules API Key */
  apiKey: ApiKeySchema,

  /** Jules Client Secret */
  clientSecret: z.string().min(1, 'Client Secret is required'),

  /** Firestore collection to store sessions */
  collectionName: CollectionNameSchema,

  /** Field to check for ownership */
  ownerField: z.string().default('ownerId'),

  /** Dependency Injection: Firebase Admin App */
  app: z
    .custom<App>((val) => val && typeof val === 'object', {
      message: 'Invalid Firebase App instance',
    })
    .optional(),

  /** Dependency Injection: Auth Service */
  auth: z
    .custom<Auth>((val) => val && typeof val === 'object', {
      message: 'Invalid Firebase Auth instance',
    })
    .optional(),

  /** Dependency Injection: Firestore Service */
  firestore: z
    .custom<Firestore>((val) => val && typeof val === 'object', {
      message: 'Invalid Firestore instance',
    })
    .optional(),

  /** Allow overriding the core strategies manually */
  verify: z.custom<ServerConfig['verify']>().optional(),
  authorize: z.custom<ServerConfig['authorize']>().optional(),
});

export type FirebaseInput = z.infer<typeof FirebaseInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

// The factory produces a valid NodeHandler function
// We wrap it in a strict schema to ensure we return what we promise
export const FirebaseOutputSchema = z.object({
  /** The fully configured NodeHandler */
  handler: z.custom<(req: Request) => Promise<Response>>(),

  /** Metadata about what was resolved (for logging/debugging) */
  resolved: z.object({
    appId: z.string(),
    projectId: z.string().optional(),
    strategy: z.enum(['firestore', 'rtdb', 'custom']),
  }),
});
export type FirebaseOutput = z.infer<typeof FirebaseOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const FirebaseErrorCode = z.enum([
  'INVALID_CONFIG',
  'MISSING_CREDENTIALS',
  'FIREBASE_INIT_ERROR',
  'STRATEGY_CONFLICT',
  'PLATFORM_ERROR',
]);
export type FirebaseErrorCode = z.infer<typeof FirebaseErrorCode>;

export const FirebaseErrorSchema = z.object({
  code: FirebaseErrorCode,
  message: z.string(),
  suggestion: z.string().optional(),
  cause: z.any().optional(),
});
export type FirebaseError = z.infer<typeof FirebaseErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export const FirebaseSuccessSchema = z.object({
  success: z.literal(true),
  output: FirebaseOutputSchema,
});

export const FirebaseFailureSchema = z.object({
  success: z.literal(false),
  error: FirebaseErrorSchema,
});

export const FirebaseResultSchema = z.discriminatedUnion('success', [
  FirebaseSuccessSchema,
  FirebaseFailureSchema,
]);
export type FirebaseResult = z.infer<typeof FirebaseResultSchema>;
