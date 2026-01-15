import { describe, it, expect } from 'vitest';
import { workflowToYaml, yamlToWorkflow } from '../src/yaml.js';
import { type Workflow } from '../src/schema.js';

describe('Workflow YAML Generation', () => {
  it('should generate valid YAML for a simple workflow', () => {
    const workflow: Workflow = {
      name: 'CI',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              uses: 'actions/checkout@v4',
            },
            {
              name: 'Run scripts',
              run: 'echo "Hello World"',
            },
          ],
        },
      },
    };

    const yaml = workflowToYaml(workflow);
    expect(yaml).toContain('name: CI');
    expect(yaml).toContain('on: push');
    expect(yaml).toContain('runs-on: ubuntu-latest');
    expect(yaml).toContain('uses: actions/checkout@v4');
  });

  it('should parse valid YAML into a Workflow object', () => {
    const yaml = `
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`;
    const workflow = yamlToWorkflow(yaml);
    expect(workflow.name).toBe('CI');
    expect(workflow.on).toEqual(['push', 'pull_request']);
    expect(workflow.jobs.test['runs-on']).toBe('ubuntu-latest');
    expect(workflow.jobs.test.steps).toHaveLength(2);
  });

  it('should throw validation error for invalid YAML structure', () => {
    const yaml = `
name: Invalid
on: push
jobs:
  test:
    runs-on: 123
`; // runs-on should be string or array of strings, not number
    expect(() => yamlToWorkflow(yaml)).toThrow();
  });
});
