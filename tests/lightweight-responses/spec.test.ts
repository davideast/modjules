/* eslint-disable @typescript-eslint/no-explicit-any */
import { JulesClientImpl } from '../../src/client.js';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Activity, JulesClient, SessionResource } from '../../src/index.js';
import { toLightweight, toSummary } from '../../src/mcp/lightweight.js';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import * as tokenizer from '../../src/mcp/tokenizer.js';
import {
  MemoryStorage,
  MemorySessionStorage,
} from '../../src/storage/memory.js';
import { mockPlatform } from '../mocks/platform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_FILE = path.resolve(
  __dirname,
  '../../spec/lightweight-responses/cases.yaml',
);

interface TestCase {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented';
  priority: string;
  given: any;
  when: string;
  then: any;
  options?: any;
}

describe('Lightweight Responses Spec', async () => {
  const specContent = await fs.readFile(SPEC_FILE, 'utf-8');
  const testCases = (yaml.load(specContent) as TestCase[]).filter(
    (c) => c.status === 'implemented',
  );

  let mockJules: JulesClient;
  let mcpServer: JulesMCPServer;

  beforeAll(() => {
    mockJules = new JulesClientImpl({
      platform: mockPlatform,
      storageFactory: {
        activity: (sessionId: string) => new MemoryStorage<Activity>(),
        session: () => new MemorySessionStorage(),
      },
      apiKey: 'test-key',
      baseUrl: 'https://test.jules.com',
      config: { requestTimeoutMs: 1000 },
    });
    mcpServer = new JulesMCPServer(mockJules);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  for (const tc of testCases) {
    it(`${tc.id}: ${tc.description}`, async () => {
      // GIVEN
      const activity = tc.given.activity as Activity;

      // WHEN
      switch (tc.when) {
        case 'toSummary':
          const summaryResult = toSummary(activity);
          if (tc.then.result) {
            expect(summaryResult).toEqual(
              expect.objectContaining(tc.then.result),
            );
          }
          if (tc.then.summaryMaxLength) {
            expect(summaryResult.summary.length).toBeLessThanOrEqual(
              tc.then.summaryMaxLength + 3,
            ); // +3 for "..."
          }
          if (tc.then.summaryEndsWith) {
            expect(
              summaryResult.summary.endsWith(tc.then.summaryEndsWith),
            ).toBe(true);
          }
          break;

        case 'toLightweight':
          const lightweightResult = toLightweight(activity, tc.options);
          if (tc.then.result) {
            if (tc.then.result.artifacts === null) {
              expect(lightweightResult.artifacts).toBeNull();
            }
            if (tc.then.result.artifactCount) {
              expect(lightweightResult.artifactCount).toBe(
                tc.then.result.artifactCount,
              );
            }
            if (tc.then.result.artifactsIncluded) {
              expect(lightweightResult.artifacts).not.toBeNull();
            }
            if (tc.then.result.artifacts) {
              expect(lightweightResult.artifacts?.[0]).toEqual(
                expect.objectContaining(tc.then.result.artifacts[0]),
              );
            }
          }
          break;

        case 'mcp_jules_get_session_status':
          vi.spyOn(mockJules, 'session').mockReturnValue({
            info: vi
              .fn()
              .mockResolvedValue({
                state: 'inProgress',
                url: 'http://test.com',
              } as SessionResource),
            history: vi.fn().mockReturnValue(
              (async function* () {
                for (const a of tc.given.activities) yield a;
              })(),
            ),
          } as any);

          const statusResult = await (mcpServer as any).handleGetSessionStatus({
            sessionId: tc.given.sessionId,
            activityLimit: tc.given.activityLimit,
          });
          const statusContent = JSON.parse(statusResult.content[0].text);
          expect(statusContent.recentActivities[0]).toEqual(
            expect.objectContaining(tc.then.result.recentActivities[0]),
          );
          break;

        case 'mcp_jules_select':
          vi.spyOn(mockJules, 'select').mockResolvedValue(
            tc.given.activities || [{ type: 'agentMessaged', message: 'test' }],
          );
          const selectResult = await (mcpServer as any).handleSelect({
            query: tc.given.query,
          });
          const selectContent = JSON.parse(selectResult.content[0].text);

          if (tc.id === 'LIGHT-12') {
            expect(selectContent._meta.tokenCount).toBeLessThanOrEqual(
              tc.then.result._meta.tokenCount.lessThanOrEqual,
            );
          } else {
            if (tc.then.result.items.each.hasSummary) {
              expect(selectContent.results[0]).toHaveProperty('summary');
            }
            if (tc.then.result.items.each.artifactsStripped) {
              expect(selectContent.results[0]).toHaveProperty(
                'artifacts',
                null,
              );
            }
            if (tc.then.result.items.each.hasFullMessage) {
              expect(selectContent.results[0]).not.toHaveProperty('summary');
              expect(selectContent.results[0]).toHaveProperty('message');
            }
          }
          break;

        case 'compare_formats':
          const activities: Activity[] = [];
          for (let i = 0; i < tc.given.activities.count; i++) {
            activities.push({
              id: `act-${i}`,
              type: 'agentMessaged',
              message: 'a'.repeat(tc.given.activities.averageMessageLength),
              artifacts: Array(tc.given.activities.averageArtifactCount).fill({
                type: 'bashOutput',
                command: 'ls',
              }),
            } as any);
          }

          const lightweightActivities = activities.map((a) => toLightweight(a));
          const lightweightTokens = tokenizer.estimateTokens(
            JSON.stringify(lightweightActivities),
          );
          const fullTokens = tokenizer.estimateTokens(
            JSON.stringify(activities),
          );

          expect(lightweightTokens).toBeLessThan(
            tc.then.lightweightTokens.lessThan,
          );
          expect(fullTokens).toBeGreaterThan(tc.then.fullTokens.greaterThan);

          break;
      }
    });
  }
});
