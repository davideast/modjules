import { z } from 'zod';
import { WorkflowBuilder } from '../workflows/builder.js';
import {
  WorkflowDefinitionSchema,
  ModjulesConfigSchema,
  WorkflowPluginSchema
} from './spec.js';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS (The Contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The interface every plugin must adhere to.
 * @template Options The configuration object this plugin accepts.
 */
export interface WorkflowPlugin<Options = any> {
  name: string;
  /**
   * Logic to mutate the builder.
   * @param builder The mutable builder instance.
   * @param options User-provided options.
   */
  apply: (builder: WorkflowBuilder, options: Options) => void | Promise<void>;
}

/**
 * A helper type for Plugin Factories (functions that return a Plugin).
 */
export type PluginFactory<Options> = (options?: Options) => WorkflowPlugin<Options>;

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type ModjulesConfig = z.infer<typeof ModjulesConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION HELPERS (The "Handler" Logic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identity function to enforce type safety on the root configuration.
 * usage: export default defineConfig({ ... })
 */
export function defineConfig(config: ModjulesConfig): ModjulesConfig {
  // We perform a shallow runtime validation here to catch obvious errors early
  const result = ModjulesConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid Modjules Configuration: ${result.error.message}`);
  }
  return config;
}

/**
 * Identity function to create a single workflow definition.
 */
export function defineWorkflow(def: WorkflowDefinition): WorkflowDefinition {
  const result = WorkflowDefinitionSchema.safeParse(def);
  if (!result.success) {
    throw new Error(`Invalid Workflow Definition '${def.name}': ${result.error.message}`);
  }
  return def;
}

/**
 * Helper to author a type-safe plugin.
 * * @example
 * export const myPlugin = definePlugin<MyOpts>((builder, opts) => { ... }, 'my-plugin');
 */
export function definePlugin<Options = any>(
  name: string,
  apply: (builder: WorkflowBuilder, options: Options) => void | Promise<void>
): (options?: Options) => WorkflowPlugin<Options> {

  // Returns a Factory Function
  return (options?: Options) => {
    const plugin: WorkflowPlugin<Options> = {
      name,
      apply: async (builder, runtimeOpts) => {
        // Merge factory options with runtime options if needed,
        // but usually we just pass the factory options through.
        // Here we ensure 'options' is passed correctly.
        return apply(builder, options as Options);
      }
    };

    // Validate the generated plugin object against the spec
    // This catches internal errors in plugin development
    const check = WorkflowPluginSchema.safeParse(plugin);
    if (!check.success) {
       console.error(`Plugin '${name}' definition is invalid`, check.error);
    }

    return plugin;
  };
}
