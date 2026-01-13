import { describe, it, expect } from 'vitest';
import { WorkflowBuilder } from '../../src/workflows/builder.js';
import { JobDefinition, StepDefinition } from '../../src/workflows/spec.js';

describe('WorkflowBuilder', () => {
  it('should create a valid workflow YAML', async () => {
    const builder = new WorkflowBuilder('Test Workflow');

    builder.on({
      push: {
        branches: ['main'],
      },
    });

    const job: JobDefinition = {
      'runs-on': 'ubuntu-latest',
      steps: [
        {
          name: 'Checkout',
          uses: 'actions/checkout@v2',
        },
      ],
    };

    const addJobResult = builder.addJob('build', job);
    expect(addJobResult.success).toBe(true);

    const step: StepDefinition = {
      name: 'Run tests',
      run: 'npm test',
    };
    const addStepResult = builder.addStep('build', step);
    expect(addStepResult.success).toBe(true);

    const result = await builder.toYaml();

    if (!result.success) {
      console.error(
        'YAML Generation Error:',
        JSON.stringify(result.error, null, 2),
      );
    }

    expect(result.success).toBe(true);
    if (result.success) {
      // Basic check for YAML structure
      expect(result.yaml).toContain('name: Test Workflow');
      expect(result.yaml).toContain('on:');
      expect(result.yaml).toContain('  push:');
      expect(result.yaml).toContain('    branches:');
      expect(result.yaml).toContain('      - main');
      expect(result.yaml).toContain('jobs:');
      expect(result.yaml).toContain('  build:');
      expect(result.yaml).toContain('    runs-on: ubuntu-latest');
      expect(result.yaml).toContain('    steps:');
      expect(result.yaml).toContain('      - name: Checkout');
      expect(result.yaml).toContain('        uses: actions/checkout@v2');
      expect(result.yaml).toContain('      - name: Run tests');
      expect(result.yaml).toContain('        run: npm test');
    }
  });

  it('should fail when adding a job with duplicate ID', () => {
    const builder = new WorkflowBuilder('Duplicate Job Test');
    const job: JobDefinition = {
      'runs-on': 'ubuntu-latest',
      steps: [{ run: 'echo hello' }],
    };

    builder.addJob('job1', job);
    const result = builder.addJob('job1', job);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DUPLICATE_JOB_ID');
    }
  });

  it('should fail when adding a step to a non-existent job', () => {
    const builder = new WorkflowBuilder('Invalid Job Step Test');
    const step: StepDefinition = { run: 'echo hello' };

    const result = builder.addStep('non-existent-job', step);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_JOB_ID');
    }
  });
});
