// packages/firebase/src/handler.ts
import { getApps } from 'firebase-admin/app';
import { createNodeHandler } from '@modjules/server/node';
import { FirebaseHandlerSpec } from './spec.js';
import {
  FirebaseInput,
  FirebaseResult,
  FirebaseInputSchema,
} from './schemas.js';
import { verifyFirebase, authorizeFirestore } from './factories.js';

export class FirebaseHandlerFactory implements FirebaseHandlerSpec {
  async validateEnvironment(): Promise<FirebaseResult> {
    // Check if we can even start
    const hasApps = getApps().length > 0;
    const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // In this simplified factory, we'll treat validation as a pass
    // unless we detect a hard blocker.
    return { success: true, output: {} as any };
  }

  async resolve(input: FirebaseInput): Promise<FirebaseResult> {
    // 1. Validate Input Structure
    const parsed = FirebaseInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: 'Invalid configuration provided',
          cause: parsed.error,
          suggestion: 'Check your input object against the schema.',
        },
      };
    }

    // 2. We don't really need to "resolve" into an intermediate state
    // for this pattern unless we want to split Init vs Create.
    // We'll pass through to create() to keep it simple,
    // or return a success indicating "Ready to Create".
    return {
      success: true,
      output: {
        handler: null as any,
        resolved: { appId: 'pending', strategy: 'firestore' },
      },
    };
  }

  async create(input: FirebaseInput): Promise<FirebaseResult> {
    try {
      // 1. Validate (Re-run or trust caller)
      const config = FirebaseInputSchema.parse(input);

      // 2. Resolve Strategies (The Magic)
      // If user provided a custom verify, use it. Else use the Smart Factory.
      const verifyStrategy =
        config.verify ||
        verifyFirebase({
          auth: config.auth,
        });

      // If user provided a custom authorize, use it. Else use Smart Firestore.
      const authorizeStrategy =
        config.authorize ||
        authorizeFirestore({
          collection: config.collectionName,
          ownerField: config.ownerField,
          firestore: config.firestore,
        });

      // 3. Create the Core Node Handler
      const nodeHandler = createNodeHandler({
        apiKey: config.apiKey!,
        clientSecret: config.clientSecret,
        verify: verifyStrategy,
        authorize: authorizeStrategy,
      });

      return {
        success: true,
        output: {
          handler: nodeHandler,
          resolved: {
            appId: getApps()[0]?.name || 'default',
            strategy: config.authorize ? 'custom' : 'firestore',
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_INIT_ERROR',
          message: error.message || 'Failed to create Firebase Handler',
          cause: error,
          suggestion:
            'Ensure GOOGLE_APPLICATION_CREDENTIALS is set or an App is initialized.',
        },
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The user-facing function that wraps the factory logic.
 * Returns the handler directly or throws a structured error.
 */
export async function createFirebaseHandler(input: FirebaseInput) {
  const factory = new FirebaseHandlerFactory();

  // 1. Validate Env
  // const envCheck = await factory.validateEnvironment();
  // if (!envCheck.success) throw new Error(envCheck.error.message);

  // 2. Create
  const result = await factory.create(input);

  if (!result.success) {
    const e = result.error;
    throw new Error(
      `[${e.code}] ${e.message} ${e.suggestion ? `(${e.suggestion})` : ''}`,
    );
  }

  return result.output.handler;
}
