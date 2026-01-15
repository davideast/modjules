import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB ACTIONS SYNTAX SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/** Valid 'on' triggers */
export const WorkflowTriggersSchema = z.object({
  push: z
    .object({
      branches: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      paths: z.array(z.string()).optional(),
    })
    .optional(),
  pull_request: z
    .object({
      types: z.array(z.string()).optional(),
      branches: z.array(z.string()).optional(),
      paths: z.array(z.string()).optional(),
    })
    .optional(),
  workflow_dispatch: z
    .object({
      inputs: z.record(z.any()).optional(),
    })
    .optional(),
  schedule: z.array(z.object({ cron: z.string() })).optional(),
});

/** A single step in a job */
export const StepSchema = z
  .object({
    name: z.string().optional(),
    id: z.string().optional(),
    if: z.string().optional(),

    // Execution: Either 'uses' or 'run' is usually required, but allowed optional for flexibility
    uses: z.string().optional(),
    run: z.string().optional(),

    with: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    env: z.record(z.string(), z.string()).optional(),

    'continue-on-error': z.boolean().optional(),
    'timeout-minutes': z.number().optional(),
  })
  .refine((data) => data.uses || data.run, {
    message: "A step must define either 'uses' or 'run'",
    path: ['uses', 'run'],
  });

/** A Job definition */
export const JobSchema = z.object({
  name: z.string().optional(),
  'runs-on': z.string().default('ubuntu-latest'),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  permissions: z
    .union([z.string(), z.record(z.string(), z.string())])
    .optional(),
  steps: z.array(StepSchema).default([]),
});

/** The full internal state structure */
export const WorkflowStateSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  on: WorkflowTriggersSchema,
  env: z.record(z.string(), z.string()).optional(),
  jobs: z.record(z.string(), JobSchema),
});

// Types inferred from schemas
export type WorkflowTrigger = z.infer<typeof WorkflowTriggersSchema>;
export type StepDefinition = z.infer<typeof StepSchema>;
export type JobDefinition = z.infer<typeof JobSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION INPUTS
// ─────────────────────────────────────────────────────────────────────────────

export const AddJobInputSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "Job ID must be alphanumeric, '-', or '_'"),
  job: JobSchema,
});
export type AddJobInput = z.infer<typeof AddJobInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const BuilderErrorCode = z.enum([
  'INVALID_TRIGGER', // 'on' config is malformed
  'INVALID_JOB_ID', // Job ID has bad chars
  'DUPLICATE_JOB_ID', // Job ID already exists
  'INVALID_STEP', // Step missing 'run'/'uses'
  'VALIDATION_FAILED', // Generic Zod failure
  'YAML_GEN_ERROR', // Stringify failed
]);
export type BuilderErrorCode = z.infer<typeof BuilderErrorCode>;

export const BuilderErrorSchema = z.object({
  code: BuilderErrorCode,
  message: z.string(),
  details: z.any().optional(),
});
export type BuilderError = z.infer<typeof BuilderErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export const BuilderResultSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.any().optional() }),
  z.object({ success: z.literal(false), error: BuilderErrorSchema }),
]);
export type BuilderResult = z.infer<typeof BuilderResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOR INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowBuilderSpec {
  /** Set the triggers. Merges with existing triggers if called multiple times. */
  on(triggers: WorkflowTrigger): this;

  /** Add a job to the workflow. Returns validation error if invalid. */
  addJob(id: string, job: JobDefinition): BuilderResult;

  /** Add a step to an existing job. */
  addStep(jobId: string, step: StepDefinition): BuilderResult;

  /** Validates the current state and returns the YAML string */
  toYaml(): Promise<
    { success: true; yaml: string } | { success: false; error: BuilderError }
  >;

  /** Get read-only copy of internal state for inspection */
  getState(): WorkflowState;
}
