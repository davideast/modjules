import { z } from 'zod';
import { ModjulesConfigSchema } from '../declarative/spec.js';

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The compiler takes the full declarative config as input.
 * We reuse the schema from Task 2.1 to ensure consistency.
 */
export const CompilerInputSchema = ModjulesConfigSchema;
export type CompilerInput = z.infer<typeof CompilerInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const CompilationArtifactSchema = z.object({
  /** The final filename (e.g. 'ci.yml') */
  filename: z.string(),
  /** The full YAML content */
  content: z.string(),
  /** The name of the workflow defined inside */
  workflowName: z.string(),
});

export const CompilerOutputSchema = z.object({
  /** Array of generated files */
  artifacts: z.array(CompilationArtifactSchema),
  /** Performance and usage stats */
  stats: z.object({
    workflowsProcessed: z.number(),
    pluginsApplied: z.number(),
    durationMs: z.number(),
  }),
});
export type CompilerOutput = z.infer<typeof CompilerOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const CompilerErrorCode = z.enum([
  'CONFIG_INVALID',       // Input config failed Zod parse
  'PLUGIN_RESOLUTION',    // Failed to load/resolve a plugin
  'PLUGIN_EXECUTION',     // Plugin threw an error during .apply()
  'BUILDER_VALIDATION',   // WorkflowBuilder failed to generate valid YAML
  'UNKNOWN_ERROR',
]);
export type CompilerErrorCode = z.infer<typeof CompilerErrorCode>;

export const CompilerErrorSchema = z.object({
  code: CompilerErrorCode,
  message: z.string(),
  /** Context to help the user fix the error */
  context: z.object({
    workflowName: z.string().optional(),
    pluginName: z.string().optional(),
    details: z.any().optional(),
  }).optional(),
  recoverable: z.boolean().default(false),
});
export type CompilerError = z.infer<typeof CompilerErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export const CompilerResultSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: CompilerOutputSchema }),
  z.object({ success: z.literal(false), error: CompilerErrorSchema }),
]);
export type CompilerResult = z.infer<typeof CompilerResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOR INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface CompilerSpec {
  /**
   * Compiles a declarative configuration into GitHub Actions YAML.
   * Does NOT write to disk (IO is separated).
   */
  compile(input: CompilerInput): Promise<CompilerResult>;
}
