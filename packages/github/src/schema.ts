import { z } from 'zod';

// Step Schema
export const stepSchema = z.object({
  name: z.string().optional(),
  id: z.string().optional(),
  if: z.string().optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  'continue-on-error': z.boolean().optional(),
  timeout_minutes: z.number().optional(),
  with: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  env: z.record(z.string()).optional(),
  working_directory: z.string().optional(),
  shell: z.string().optional(),
});

export type Step = z.infer<typeof stepSchema>;

// Job Schema
export const jobSchema = z.object({
  name: z.string().optional(),
  'runs-on': z.union([z.string(), z.array(z.string())]).optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  environment: z.union([
      z.string(),
      z.object({
          name: z.string(),
          url: z.string().optional()
      })
  ]).optional(),
  outputs: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  defaults: z.object({
      run: z.object({
          shell: z.string().optional(),
          'working-directory': z.string().optional()
      }).optional()
  }).optional(),
  steps: z.array(stepSchema).optional(),
  strategy: z.object({
    matrix: z.record(z.array(z.any())).optional(),
    'fail-fast': z.boolean().optional(),
    'max-parallel': z.number().optional(),
  }).optional(),
  services: z.record(z.any()).optional(),
});

export type Job = z.infer<typeof jobSchema>;

// Triggers Schema (Simplified)
export const workflowTriggersSchema = z.union([
    z.string(), // e.g. "push"
    z.array(z.string()), // e.g. ["push", "pull_request"]
    z.record(z.any()) // e.g. { push: { branches: ["main"] } }
]);

export type WorkflowTriggers = z.infer<typeof workflowTriggersSchema>;

// Workflow Schema
export const workflowSchema = z.object({
  name: z.string().optional(),
  run_name: z.string().optional(),
  on: workflowTriggersSchema,
  env: z.record(z.string()).optional(),
  defaults: z.object({
      run: z.object({
          shell: z.string().optional(),
          'working-directory': z.string().optional()
      }).optional()
  }).optional(),
  concurrency: z.union([
      z.string(),
      z.object({
          group: z.string(),
          'cancel-in-progress': z.boolean().optional()
      })
  ]).optional(),
  jobs: z.record(jobSchema),
  permissions: z.union([
    z.literal('read-all'),
    z.literal('write-all'),
    z.record(z.union([z.literal('read'), z.literal('write'), z.literal('none')]))
  ]).optional()
});

export type Workflow = z.infer<typeof workflowSchema>;
