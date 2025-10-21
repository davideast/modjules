// src/index.ts
import { JulesClientImpl } from './client.js';
import { JulesClient, JulesOptions } from './types.js';

/**
 * The main entry point for the Jules SDK.
 * This factory function initializes the Jules client.
 *
 * @example
 * import { Jules } from 'julets';
 * const jules = Jules();
 *
 * @param options Configuration options for the SDK.
 * @returns An initialized JulesClient instance.
 */
export function Jules(options?: JulesOptions): JulesClient {
  return new JulesClientImpl(options);
}

// Re-export all the types for convenience
export * from './types.js';
