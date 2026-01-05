/**
 * Query Language Specification Tests
 *
 * Tests for the Jules Query Language (JQL) implementation based on
 * spec/query-language/grammar.md and spec/query-language/cases.yaml
 */
import { describe, it, expect } from 'vitest';
import {
  parseSelectExpression,
  projectDocument,
  getPath,
  deletePath,
} from '../../src/query/projection.js';
import {
  computeArtifactCount,
  computeSummary,
  computeDurationMs,
  injectActivityComputedFields,
  injectSessionComputedFields,
  DEFAULT_ACTIVITY_PROJECTION,
  DEFAULT_SESSION_PROJECTION,
} from '../../src/query/computed.js';
import { Activity, BashArtifact } from '../../src/types.js';

describe('JQL Projection Engine', () => {
  describe('parseSelectExpression', () => {
    it('SEL-01: should parse simple field name', () => {
      const result = parseSelectExpression('id');
      expect(result).toEqual({
        path: ['id'],
        exclude: false,
        wildcard: false,
      });
    });

    it('SEL-10: should parse dot notation path', () => {
      const result = parseSelectExpression('artifacts.type');
      expect(result).toEqual({
        path: ['artifacts', 'type'],
        exclude: false,
        wildcard: false,
      });
    });

    it('SEL-11: should parse deeply nested path', () => {
      const result = parseSelectExpression('plan.steps.title');
      expect(result).toEqual({
        path: ['plan', 'steps', 'title'],
        exclude: false,
        wildcard: false,
      });
    });

    it('SEL-20: should parse exclusion prefix', () => {
      const result = parseSelectExpression('-artifacts.data');
      expect(result).toEqual({
        path: ['artifacts', 'data'],
        exclude: true,
        wildcard: false,
      });
    });

    it('SEL-21: should parse wildcard', () => {
      const result = parseSelectExpression('*');
      expect(result).toEqual({
        path: [],
        exclude: false,
        wildcard: true,
      });
    });
  });

  describe('getPath', () => {
    it('should get nested value', () => {
      const doc = { a: { b: { c: 'value' } } };
      expect(getPath(doc, ['a', 'b', 'c'])).toBe('value');
    });

    it('SEL-10: should traverse arrays and collect values', () => {
      const doc = {
        artifacts: [
          { type: 'bashOutput', command: 'ls' },
          { type: 'changeSet', source: 'github' },
        ],
      };
      expect(getPath(doc, ['artifacts', 'type'])).toEqual([
        'bashOutput',
        'changeSet',
      ]);
    });

    it('should return undefined for missing paths', () => {
      const doc = { a: { b: 1 } };
      expect(getPath(doc, ['a', 'c'])).toBeUndefined();
    });

    it('EDGE-02: should handle null values gracefully', () => {
      const doc = { a: null };
      expect(getPath(doc, ['a', 'b'])).toBeUndefined();
    });
  });

  describe('projectDocument', () => {
    const fullDoc = {
      id: 'act_1',
      type: 'agentMessaged',
      createTime: '2024-01-01T00:00:00Z',
      originator: 'agent',
      message: 'Hello world',
      artifacts: [
        {
          type: 'bashOutput',
          command: 'ls -la',
          stdout: 'file1.txt\nfile2.txt',
          stderr: '',
          exitCode: 0,
        },
        {
          type: 'media',
          format: 'image/png',
          data: 'base64data...',
        },
      ],
      plan: {
        id: 'plan_1',
        steps: [
          { id: 'step_1', title: 'First step' },
          { id: 'step_2', title: 'Second step' },
        ],
      },
    };

    it('SEL-02: should project multiple fields', () => {
      const result = projectDocument(fullDoc, ['id', 'type', 'createTime']);
      expect(result).toEqual({
        id: 'act_1',
        type: 'agentMessaged',
        createTime: '2024-01-01T00:00:00Z',
      });
    });

    it('SEL-10: should project nested paths from arrays', () => {
      const result = projectDocument(fullDoc, ['id', 'artifacts.type']);
      expect(result).toEqual({
        id: 'act_1',
        artifacts: [{ type: 'bashOutput' }, { type: 'media' }],
      });
    });

    it('SEL-12: should project nested paths from objects', () => {
      const result = projectDocument(fullDoc, ['id', 'plan.steps.title']);
      expect(result).toEqual({
        id: 'act_1',
        plan: {
          steps: [{ title: 'First step' }, { title: 'Second step' }],
        },
      });
    });

    it('SEL-13: should project multiple nested paths', () => {
      const result = projectDocument(fullDoc, [
        'id',
        'artifacts.type',
        'artifacts.command',
      ]);
      expect(result).toEqual({
        id: 'act_1',
        artifacts: [
          { type: 'bashOutput', command: 'ls -la' },
          { type: 'media' }, // No command field on media
        ],
      });
    });

    it('SEL-20: should handle wildcard with exclusion', () => {
      const result = projectDocument(fullDoc, ['*', '-artifacts.data']);
      expect(result.id).toBe('act_1');
      expect(result.message).toBe('Hello world');
      expect(result.artifacts).toHaveLength(2);
      // Data should be excluded
      expect((result.artifacts as any[])[1].data).toBeUndefined();
      // Other fields should remain
      expect((result.artifacts as any[])[1].format).toBe('image/png');
    });

    it('SEL-22: should exclude nested field', () => {
      const result = projectDocument(fullDoc, ['*', '-artifacts.stdout']);
      expect((result.artifacts as any[])[0].command).toBe('ls -la');
      expect((result.artifacts as any[])[0].stdout).toBeUndefined();
    });

    it('EDGE-03: should handle empty arrays', () => {
      const doc = { id: 'test', artifacts: [] };
      const result = projectDocument(doc, ['id', 'artifacts.type']);
      expect(result).toEqual({ id: 'test', artifacts: [] });
    });

    it('EDGE-04: should preserve full nested object when selecting parent', () => {
      const result = projectDocument(fullDoc, ['id', 'plan']);
      expect(result.id).toBe('act_1');
      expect(result.plan).toEqual(fullDoc.plan);
    });
  });

  describe('deletePath', () => {
    it('should delete nested path', () => {
      const doc = { a: { b: { c: 1 } } };
      deletePath(doc, ['a', 'b', 'c']);
      expect(doc.a.b).toEqual({});
    });

    it('should delete from array elements', () => {
      const doc = {
        items: [
          { data: 'x', keep: 1 },
          { data: 'y', keep: 2 },
        ],
      };
      deletePath(doc, ['items', 'data']);
      expect(doc.items).toEqual([{ keep: 1 }, { keep: 2 }]);
    });
  });
});

describe('JQL Computed Fields', () => {
  describe('computeArtifactCount', () => {
    it('COMP-01: should count artifacts', () => {
      const activity = {
        id: 'act_1',
        artifacts: [{ type: 'bashOutput' }, { type: 'changeSet' }],
      } as unknown as Activity;

      expect(computeArtifactCount(activity)).toBe(2);
    });

    it('COMP-02: should return 0 for no artifacts', () => {
      const activity = {
        id: 'act_1',
        artifacts: [],
      } as unknown as Activity;

      expect(computeArtifactCount(activity)).toBe(0);
    });

    it('should handle missing artifacts array', () => {
      const activity = { id: 'act_1' } as unknown as Activity;
      expect(computeArtifactCount(activity)).toBe(0);
    });
  });

  describe('computeSummary', () => {
    it('COMP-03: should generate summary for agentMessaged', () => {
      const activity = {
        id: 'act_1',
        type: 'agentMessaged',
        createTime: '2024-01-01T00:00:00Z',
        message: 'I fixed the bug by updating the configuration file.',
      } as Activity;

      const summary = computeSummary(activity);
      // Summary returns the message itself for agentMessaged
      expect(summary).toContain('I fixed the bug');
    });

    it('COMP-04: should generate summary for planGenerated', () => {
      const activity = {
        id: 'act_1',
        type: 'planGenerated',
        createTime: '2024-01-01T00:00:00Z',
        plan: {
          id: 'plan_1',
          createTime: '2024-01-01T00:00:00Z',
          steps: [
            { id: 's1', title: 'Step 1', index: 0 },
            { id: 's2', title: 'Step 2', index: 1 },
            { id: 's3', title: 'Step 3', index: 2 },
          ],
        },
      } as unknown as Activity;

      const summary = computeSummary(activity);
      expect(summary).toContain('3');
    });
  });

  describe('computeDurationMs', () => {
    it('COMP-05: should calculate duration in milliseconds', () => {
      const session = {
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T01:00:00Z',
      };

      const duration = computeDurationMs(session);
      expect(duration).toBe(3600000); // 1 hour in ms
    });

    it('should return 0 for missing times', () => {
      expect(computeDurationMs({})).toBe(0);
      expect(computeDurationMs({ createTime: '2024-01-01' })).toBe(0);
    });

    it('should return 0 for invalid dates', () => {
      const session = {
        createTime: 'invalid',
        updateTime: 'also-invalid',
      };
      expect(computeDurationMs(session)).toBe(0);
    });
  });

  describe('injectActivityComputedFields', () => {
    const activity = {
      id: 'act_1',
      type: 'agentMessaged',
      message: 'Hello',
      createTime: '2024-01-01T00:00:00Z',
      originator: 'agent',
      name: 'sessions/sess_1/activities/act_1',
      artifacts: [
        {
          type: 'bashOutput',
          command: 'ls',
          stdout: 'files',
          stderr: '',
          exitCode: 0,
          toString: () => 'ls: files',
        } as BashArtifact,
      ],
    } as Activity;

    it('should inject computed fields when not specified', () => {
      const result = injectActivityComputedFields(activity);
      expect(result.artifactCount).toBe(1);
      expect(result.summary).toBeDefined();
    });

    it('should only inject requested computed fields', () => {
      const result = injectActivityComputedFields(activity, [
        'id',
        'artifactCount',
      ]);
      expect(result.artifactCount).toBe(1);
      // summary not injected because not requested
    });

    it('should inject all computed fields with wildcard', () => {
      const result = injectActivityComputedFields(activity, ['*']);
      expect(result.artifactCount).toBe(1);
      expect(result.summary).toBeDefined();
    });
  });

  describe('injectSessionComputedFields', () => {
    const session = {
      id: 'sess_1',
      title: 'Test Session',
      createTime: '2024-01-01T00:00:00Z',
      updateTime: '2024-01-01T02:00:00Z',
    };

    it('should inject durationMs when not specified', () => {
      const result = injectSessionComputedFields(session);
      expect(result.durationMs).toBe(7200000); // 2 hours
    });

    it('should only inject requested computed fields', () => {
      const result = injectSessionComputedFields(session, ['id', 'durationMs']);
      expect(result.durationMs).toBe(7200000);
    });
  });

  describe('Default Projections', () => {
    it('should have correct default activity projection', () => {
      expect(DEFAULT_ACTIVITY_PROJECTION).toEqual([
        'id',
        'type',
        'createTime',
        'originator',
        'artifactCount',
        'summary',
      ]);
    });

    it('should have correct default session projection', () => {
      expect(DEFAULT_SESSION_PROJECTION).toEqual([
        'id',
        'state',
        'title',
        'createTime',
      ]);
    });
  });
});

describe('JQL Where Clause (Dot Notation)', () => {
  // These tests verify the matching behavior in select.ts
  // We'll import and test the matching functions directly

  describe('Existential Matching for Arrays', () => {
    // The WHERE-10 to WHERE-14 test cases from the spec
    // These are integration tests that verify the full query path
    // For now, we test the getPath behavior which underpins existential matching

    it('WHERE-10: should find value in array (existential)', () => {
      const doc = {
        artifacts: [{ type: 'bashOutput', exitCode: 0 }, { type: 'changeSet' }],
      };

      const types = getPath(doc, ['artifacts', 'type']);
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('bashOutput');
    });

    it('WHERE-11: should find nested value in array', () => {
      const doc = {
        artifacts: [
          { type: 'bashOutput', exitCode: 1 },
          { type: 'bashOutput', exitCode: 0 },
        ],
      };

      const exitCodes = getPath(doc, ['artifacts', 'exitCode']);
      expect(Array.isArray(exitCodes)).toBe(true);
      expect(exitCodes).toContain(1);
      expect(exitCodes).toContain(0);
    });

    it('WHERE-14: should handle missing nested field', () => {
      const doc = {
        artifacts: [{ type: 'media' }],
      };

      const exitCodes = getPath(doc, ['artifacts', 'exitCode']);
      expect(exitCodes).toBeUndefined();
    });
  });
});

describe('JQL Schema Introspection', () => {
  // Basic smoke tests for the schema module
  it('should export schema structures', async () => {
    const { getAllSchemas, getSchema } = await import(
      '../../src/mcp/schema.js'
    );

    const schemas = getAllSchemas();
    expect(schemas.sessions).toBeDefined();
    expect(schemas.activities).toBeDefined();
    expect(schemas.filterOps).toBeDefined();
    expect(schemas.projection).toBeDefined();

    const sessionSchema = getSchema('sessions');
    expect(sessionSchema.domain).toBe('sessions');
    expect(sessionSchema.fields.length).toBeGreaterThan(0);

    const activitySchema = getSchema('activities');
    expect(activitySchema.domain).toBe('activities');
    expect(activitySchema.fields.length).toBeGreaterThan(0);
  });

  it('should generate markdown documentation', async () => {
    const { generateMarkdownDocs } = await import('../../src/mcp/schema.js');

    const markdown = generateMarkdownDocs();
    expect(markdown).toContain('# Jules Query Language');
    expect(markdown).toContain('## Sessions Domain');
    expect(markdown).toContain('## Activities Domain');
    expect(markdown).toContain('## Filter Operators');
    expect(markdown).toContain('## Projection (Select)');
  });
});
