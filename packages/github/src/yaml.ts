import { parse, stringify } from 'yaml';
import { type Workflow, workflowSchema } from './schema.js';

/**
 * Converts a Workflow object to a YAML string.
 * @param workflow The Workflow object.
 * @returns The YAML string.
 */
export function workflowToYaml(workflow: Workflow): string {
  // Use default stringify options, but we can customize if needed.
  // GitHub Actions often uses 2 spaces indentation which is default for 'yaml' library usually.
  return stringify(workflow, {
    indent: 2,
    lineWidth: 0, // Disable line wrapping for long strings like shell commands
  });
}

/**
 * Parses a YAML string into a Workflow object, validating it against the schema.
 * @param yamlString The YAML string.
 * @returns The Workflow object.
 * @throws If validation fails.
 */
export function yamlToWorkflow(yamlString: string): Workflow {
  const parsed = parse(yamlString);
  return workflowSchema.parse(parsed);
}

/**
 * Parses a YAML string into a Workflow object, validating it against the schema.
 * Returns a result object instead of throwing.
 */
export function safeYamlToWorkflow(yamlString: string) {
  const parsed = parse(yamlString);
  return workflowSchema.safeParse(parsed);
}
