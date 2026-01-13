import { stringify } from 'yaml';
import {
  WorkflowBuilderSpec,
  WorkflowState,
  WorkflowTrigger,
  JobDefinition,
  StepDefinition,
  AddJobInputSchema,
  WorkflowStateSchema,
  StepSchema,
  BuilderResult,
  WorkflowTriggersSchema,
  BuilderError,
} from './spec.js';

export class WorkflowBuilder implements WorkflowBuilderSpec {
  private state: WorkflowState;

  constructor(name: string) {
    this.state = {
      name,
      on: {},
      jobs: {},
    };
  }

  /**
   * Defines or updates the workflow triggers.
   * Merges with existing triggers to allow composition from multiple sources.
   */
  public on(triggers: WorkflowTrigger): this {
    // Validate input first
    const result = WorkflowTriggersSchema.safeParse(triggers);
    if (!result.success) {
      console.warn('Invalid trigger definition passed to .on()', result.error);
      return this; // Chainable, but maybe should throw in strict mode
    }

    // Deep merge logic (simplified for clarity)
    this.state.on = {
      ...this.state.on,
      ...triggers,
      push: { ...this.state.on.push, ...triggers.push },
      pull_request: { ...this.state.on.pull_request, ...triggers.pull_request },
    };

    return this;
  }

  /**
   * Adds a job to the workflow.
   * Fails if the Job ID is invalid or already exists.
   */
  public addJob(id: string, job: JobDefinition): BuilderResult {
    // 1. Validate Input (ID format and Job Structure)
    const inputResult = AddJobInputSchema.safeParse({ id, job });
    if (!inputResult.success) {
      return {
        success: false,
        error: {
          code: 'INVALID_JOB_ID', // Simplified mapping, could check error path
          message: 'Invalid Job ID or Job Definition',
          details: inputResult.error.format(),
        },
      };
    }

    // 2. Check Duplicates
    if (this.state.jobs[id]) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_JOB_ID',
          message: `Job with ID '${id}' already exists.`,
        },
      };
    }

    // 3. Update State
    this.state.jobs[id] = job;
    return { success: true };
  }

  /**
   * Appends a step to an existing job.
   * Useful for plugins that need to inject logic (e.g. "Setup Node").
   */
  public addStep(jobId: string, step: StepDefinition): BuilderResult {
    // 1. Validate Step
    const stepResult = StepSchema.safeParse(step);
    if (!stepResult.success) {
      return {
        success: false,
        error: {
          code: 'INVALID_STEP',
          message: 'Invalid Step Definition',
          details: stepResult.error.format(),
        },
      };
    }

    // 2. Check Job Existence
    const job = this.state.jobs[jobId];
    if (!job) {
      return {
        success: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: `Cannot add step to non-existent job '${jobId}'`,
        },
      };
    }

    // 3. Mutate State
    job.steps.push(step);
    return { success: true };
  }

  public getState(): WorkflowState {
    return structuredClone(this.state);
  }

  /**
   * Finalizes the workflow and returns the YAML string.
   * Performs a final validation of the entire tree before generation.
   */
  public async toYaml(): Promise<
    { success: true; yaml: string } | { success: false; error: BuilderError }
  > {
    // 1. Full State Validation
    const validation = WorkflowStateSchema.safeParse(this.state);

    if (!validation.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Final workflow state is invalid',
          details: validation.error.format(),
        },
      };
    }

    try {
      // 2. Generate YAML
      // We explicitly sort keys to ensure 'name' and 'on' appear at the top
      const yaml = stringify(this.state, {
        sortMapEntries: (a, b) => {
          // Cast a.key and b.key to string to ensure type safety.
          // The keys in WorkflowState are always strings.
          const keyA = String(a.key);
          const keyB = String(b.key);

          const order = ['name', 'on', 'env', 'jobs'];
          const idxA = order.indexOf(keyA);
          const idxB = order.indexOf(keyB);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return keyA.localeCompare(keyB);
        },
      });

      return { success: true, yaml };
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: 'YAML_GEN_ERROR',
          message: e.message || 'Failed to stringify YAML',
        },
      };
    }
  }
}
