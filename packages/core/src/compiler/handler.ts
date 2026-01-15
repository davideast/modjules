import { CompilerSpec, CompilerInput, CompilerResult } from './spec.js';
import { WorkflowBuilder } from '../workflows/builder.js';
import { WorkflowPlugin } from '../declarative/index.js';

export class WorkflowCompilerHandler implements CompilerSpec {

  async compile(input: CompilerInput): Promise<CompilerResult> {
    const startTime = performance.now();
    let pluginsAppliedCount = 0;
    const artifacts = [];

    // 1. Iterate over defined workflows
    for (const def of input.workflows) {
      const builder = new WorkflowBuilder(def.name);

      // 2. Apply Base Triggers
      try {
        builder.on(def.triggers);
      } catch (e: any) {
         return this.fail('BUILDER_VALIDATION', `Invalid triggers in workflow '${def.name}'`, {
           workflowName: def.name, details: e.message
         });
      }

      // 3. Apply Plugins
      for (const entry of def.plugins) {
        let plugin: WorkflowPlugin;
        let options: any = {};

        // Resolve Entry: It can be a Plugin object or a [Plugin, Options] tuple
        if (Array.isArray(entry)) {
          [plugin, options] = entry;
        } else {
          plugin = entry;
        }

        try {
          // EXECUTE PLUGIN LOGIC
          await plugin.apply(builder, options);
          pluginsAppliedCount++;
        } catch (e: any) {
          // Contextualize error for the user/agent
          return this.fail('PLUGIN_EXECUTION', `Plugin '${plugin.name}' failed: ${e.message}`, {
            workflowName: def.name,
            pluginName: plugin.name,
            details: e.stack
          });
        }
      }

      // 4. Finalize & Generate YAML
      const buildResult = await builder.toYaml();

      if (!buildResult.success) {
        return this.fail('BUILDER_VALIDATION', `Workflow '${def.name}' generated invalid YAML`, {
          workflowName: def.name,
          details: buildResult.error
        });
      }

      artifacts.push({
        filename: def.filename,
        content: buildResult.yaml,
        workflowName: def.name
      });
    }

    const endTime = performance.now();

    return {
      success: true,
      data: {
        artifacts,
        stats: {
          workflowsProcessed: input.workflows.length,
          pluginsApplied: pluginsAppliedCount,
          durationMs: endTime - startTime
        }
      }
    };
  }

  /** Helper to construct error objects consistent with the schema */
  private fail(code: any, message: string, context: any): CompilerResult {
    return {
      success: false,
      error: {
        code,
        message,
        context,
        recoverable: false
      }
    };
  }
}
