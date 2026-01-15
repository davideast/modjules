import { describe, it, expect, vi } from 'vitest';
import { definePlugin, defineConfig, defineWorkflow, WorkflowPlugin } from '../../src/declarative/index.js';
import { WorkflowBuilder } from '../../src/workflows/builder.js';

describe('Declarative System', () => {
  describe('definePlugin', () => {
    it('should create a plugin factory', () => {
      const myPlugin = definePlugin<{ foo: string }>('my-plugin', (builder, options) => {
        // no-op
      });

      const plugin = myPlugin({ foo: 'bar' });
      expect(plugin.name).toBe('my-plugin');
      expect(typeof plugin.apply).toBe('function');
    });

    it('should validate plugin structure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // We can't easily force an invalid plugin internally via definePlugin because of types,
      // but we can verify that the returned object matches the contract.
      const myPlugin = definePlugin('valid-plugin', () => {});
      const plugin = myPlugin();

      expect(plugin.name).toBe('valid-plugin');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should apply logic to builder', async () => {
      const mockBuilder = {
        name: 'test',
        // partial mock of builder
      } as unknown as WorkflowBuilder;

      const applySpy = vi.fn();
      const myPlugin = definePlugin('spy-plugin', applySpy);

      const plugin = myPlugin({ some: 'opt' });
      await plugin.apply(mockBuilder, { some: 'opt' });

      expect(applySpy).toHaveBeenCalledWith(mockBuilder, { some: 'opt' });
    });
  });

  describe('defineConfig', () => {
    it('should validate valid config', () => {
      const config = defineConfig({
        workflows: [
          {
            name: 'test-workflow',
            filename: 'test.yml',
            triggers: { push: { branches: ['main'] } },
            plugins: []
          }
        ]
      });
      expect(config.workflows).toHaveLength(1);
    });

    it('should throw on invalid config', () => {
      expect(() => {
        defineConfig({
          workflows: [
            {
              // @ts-ignore
              name: 123, // Invalid type
              filename: 'test.yml',
              triggers: {},
            }
          ]
        } as any);
      }).toThrow('Invalid Modjules Configuration');
    });
  });

  describe('defineWorkflow', () => {
    it('should validate valid workflow', () => {
      const workflow = defineWorkflow({
        name: 'test',
        filename: 'ci.yml',
        triggers: {},
        plugins: []
      });
      expect(workflow.name).toBe('test');
    });

    it('should throw on invalid filename', () => {
      expect(() => {
        defineWorkflow({
          name: 'test',
          filename: 'invalid', // Missing .yml
          triggers: {},
          plugins: []
        });
      }).toThrow('Invalid Workflow Definition');
    });
  });
});
