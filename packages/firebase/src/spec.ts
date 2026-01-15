// packages/firebase/src/spec.ts
import { FirebaseInput, FirebaseResult } from './schemas.js';

export interface FirebaseHandlerSpec {
  /**
   * 1. Validate environment is ready.
   * Checks for GOOGLE_APPLICATION_CREDENTIALS or existing Apps.
   */
  validateEnvironment(): Promise<FirebaseResult>;

  /**
   * 2. Resolve configuration plan.
   * Validates input, initializes Firebase App/Services if needed.
   */
  resolve(input: FirebaseInput): Promise<FirebaseResult>;

  /**
   * 3. Create the Handler.
   * Composes the strategies and returns the executable handler.
   */
  create(input: FirebaseInput): Promise<FirebaseResult>;
}
