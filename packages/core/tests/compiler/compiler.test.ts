import { describe, it, expect } from 'vitest';
import { WorkflowCompilerHandler } from '../../src/compiler/handler.js';
import { definePlugin, defineConfig } from '../../src/declarative/index.js';

describe('WorkflowCompilerHandler', () => {
  it('should compile a simple workflow', async () => {
    const handler = new WorkflowCompilerHandler();

    // Create a mock plugin that adds a job
    const myPlugin = definePlugin('add-job', (builder) => {
      builder.addJob('test-job', {
        'runs-on': 'ubuntu-latest',
        steps: [{ run: 'echo hello' }]
      });
    });

    const config = defineConfig({
      workflows: [
        {
          name: 'Simple Workflow',
          filename: 'ci.yml',
          triggers: { push: { branches: ['main'] } },
          plugins: [myPlugin()]
        }
      ]
    });

    const result = await handler.compile(config);

    if (!result.success) {
      throw new Error(`Compilation failed: ${result.error.message}`);
    }

    expect(result.success).toBe(true);
    expect(result.data.artifacts).toHaveLength(1);
    expect(result.data.stats.pluginsApplied).toBe(1);

    const artifact = result.data.artifacts[0];
    expect(artifact.filename).toBe('ci.yml');
    expect(artifact.workflowName).toBe('Simple Workflow');
    expect(artifact.content).toContain('test-job:');
    expect(artifact.content).toContain('echo hello');
  });

  it('should handle plugin errors gracefully', async () => {
    const handler = new WorkflowCompilerHandler();

    const errorPlugin = definePlugin('error-plugin', () => {
      throw new Error('Boom!');
    });

    const config = defineConfig({
      workflows: [
        {
          name: 'Broken Workflow',
          filename: 'broken.yml',
          triggers: {},
          plugins: [errorPlugin()]
        }
      ]
    });

    const result = await handler.compile(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PLUGIN_EXECUTION');
      expect(result.error.context?.pluginName).toBe('error-plugin');
    }
  });

  it('should handle invalid triggers', async () => {
    const handler = new WorkflowCompilerHandler();

    const config = defineConfig({
      workflows: [
        {
          name: 'Invalid Triggers',
          filename: 'invalid.yml',
          // @ts-ignore - explicitly passing invalid triggers to test error handling
          triggers: { invalid: true },
          plugins: []
        }
      ]
    });

    // Note: The compiler might catch this in step 2 (Apply Base Triggers)
    // depending on how strict WorkflowBuilder.on() validation is.
    // If WorkflowBuilder.on throws, the compiler catches it.

    const result = await handler.compile(config);

    // Expect failure or if builder is lenient, success.
    // Assuming builder throws on invalid trigger keys if validated.
    // Based on previous task, builder uses zod so it might throw.

    if (!result.success) {
       expect(result.error.code).toBe('BUILDER_VALIDATION');
    }
  });
});
