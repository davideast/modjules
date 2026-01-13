import { z } from 'zod';
import { WorkflowTriggersSchema } from '../workflows/spec.js';

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/** * Zod cannot validate the internal logic of a function,
 * but we can verify the 'apply' property exists and is a function.
 */
export const PluginFunctionSchema = z.function()
  .args(z.any(), z.any()) // (builder, options)
  .returns(z.union([z.void(), z.promise(z.void())]));

export const WorkflowPluginSchema = z.object({
  name: z.string().min(1, "Plugin must have a name"),
  apply: PluginFunctionSchema,
});

/**
 * A Plugin Entry in the config can be:
 * 1. A Plugin object (already instantiated)
 * 2. A Tuple of [Plugin Factory, Options] (for lazy evaluation/serialization support)
 */
export const PluginEntrySchema = z.union([
  WorkflowPluginSchema,
  z.tuple([WorkflowPluginSchema, z.record(z.any())])
]);

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW DEFINITION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowDefinitionSchema = z.object({
  /** The name of the workflow (appears in GitHub Actions UI) */
  name: z.string().min(1),

  /** The output filename (e.g., 'ci.yml') */
  filename: z.string().regex(/^[a-zA-Z0-9._-]+\.yml$/, "Filename must end in .yml"),

  /** Triggers (Push, PR, etc.) */
  triggers: WorkflowTriggersSchema,

  /** List of plugins to compose */
  plugins: z.array(PluginEntrySchema).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CONFIGURATION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const ModjulesConfigSchema = z.object({
  /** Array of workflows to generate */
  workflows: z.array(WorkflowDefinitionSchema),

  /** Global settings for the compiler */
  settings: z.object({
    dryRun: z.boolean().default(false),
    verbose: z.boolean().default(false),
  }).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const ConfigErrorCode = z.enum([
  'INVALID_CONFIG',     // The object structure is wrong
  'PLUGIN_ERROR',       // A plugin failed to apply
  'DUPLICATE_WORKFLOW', // Two workflows have same filename
  'MISSING_NAME',
]);
export type ConfigErrorCode = z.infer<typeof ConfigErrorCode>;
