#!/usr/bin/env bun
/**
 * Active Session Monitor
 *
 * Monitors a Jules session in real-time and uses an LLM to detect when
 * the agent is stuck, failing repeatedly, or going off-track. Automatically
 * intervenes with guidance messages when needed.
 *
 * Usage:
 *   bun scripts/monitor.ts <session-id>
 *
 * Environment:
 *   JULES_API_KEY - Required for Jules client
 *   GEMINI_API_KEY - Required for Gemini analysis
 */

import { jules } from '../src/index.js';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { Activity } from '../src/index.js';

// Configuration
const ANALYSIS_WINDOW = 10; // Analyze last N activities
const CHECK_INTERVAL = 5; // Check every N activities
const MAX_RETRIES = 3; // Max consecutive failures before intervention

interface MonitoringContext {
  sessionId: string;
  goal: string;
  recentActivities: Activity[];
  consecutiveFailures: number;
  interventionCount: number;
}

async function analyzeSession(context: MonitoringContext): Promise<{
  shouldIntervene: boolean;
  reason?: string;
  guidance?: string;
}> {
  const { recentActivities, goal, consecutiveFailures } = context;

  // Build analysis prompt
  const activitySummary = recentActivities.map((a) => ({
    type: a.type,
    time: a.createTime,
    summary: summarizeActivity(a),
  }));

  const prompt = `You are monitoring an AI coding agent (Jules) working on a task.

**Goal**: ${goal}

**Recent Activities** (last ${recentActivities.length}):
${JSON.stringify(activitySummary, null, 2)}

**Consecutive Failures**: ${consecutiveFailures}

Analyze the agent's progress and determine if intervention is needed.

Look for these warning signs:
1. **Repetitive failures** - Same command/action failing multiple times
2. **Thrashing** - Reverting changes or repeating the same steps
3. **Off-track** - Actions that don't align with the goal
4. **Stuck** - No meaningful progress in recent activities

Respond in JSON format:
{
  "shouldIntervene": true/false,
  "reason": "brief explanation of the issue",
  "guidance": "specific message to send to the agent to get back on track"
}

If the agent is making steady progress, set shouldIntervene to false.`;

  try {
    const result = await generateText({
      model: google('gemini-3-flash-preview'),
      prompt,
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    const decision = JSON.parse(result.text);
    return decision;
  } catch (error) {
    console.error('Failed to analyze session:', error);
    return { shouldIntervene: false };
  }
}

function summarizeActivity(activity: Activity): string {
  switch (activity.type) {
    case 'planGenerated':
      return `Plan with ${activity.plan?.steps?.length || 0} steps`;
    case 'planApproved':
      return 'Plan approved';
    case 'progressUpdated':
      return activity.title || activity.description || 'Progress update';
    case 'sessionCompleted':
      return 'Session completed';
    case 'sessionFailed':
      return `Failed: ${activity.reason}`;
    case 'userMessaged':
      return `User: ${activity.message?.substring(0, 50)}...`;
    case 'agentMessaged':
      return `Agent: ${activity.message?.substring(0, 50)}...`;
  }
}

function isFailureActivity(activity: Activity): boolean {
  return activity.type === 'sessionFailed';
}

async function monitorSession(sessionId: string) {
  console.log(`🔍 Starting monitor for session: ${sessionId}`);

  const client = jules.session(sessionId);

  // Get initial session info
  const info = await client.info();
  console.log(`📋 Goal: ${info.title || 'Unknown'}`);
  console.log(`📊 State: ${info.state}`);
  console.log(`🔗 URL: ${info.url}`);

  const context: MonitoringContext = {
    sessionId,
    goal: info.title || 'Unknown goal',
    recentActivities: [],
    consecutiveFailures: 0,
    interventionCount: 0,
  };

  let activityCount = 0;

  console.log('\\n👀 Watching for activities...\\n');

  try {
    for await (const activity of client.stream()) {
      activityCount++;

      // Add to context
      context.recentActivities.push(activity);
      if (context.recentActivities.length > ANALYSIS_WINDOW) {
        context.recentActivities.shift();
      }

      // Track consecutive failures
      if (isFailureActivity(activity)) {
        context.consecutiveFailures++;
      } else if (
        activity.type === 'progressUpdated' ||
        activity.type === 'planApproved'
      ) {
        context.consecutiveFailures = 0; // Reset on progress
      }

      // Log activity
      console.log(
        `[${new Date(activity.createTime).toLocaleTimeString()}] ${activity.type}: ${summarizeActivity(activity)}`,
      );

      // Check if we should analyze
      const shouldAnalyze =
        activityCount % CHECK_INTERVAL === 0 ||
        context.consecutiveFailures >= MAX_RETRIES;

      if (shouldAnalyze && context.recentActivities.length >= 3) {
        console.log('\\n🤖 Analyzing session state...\\n');

        const decision = await analyzeSession(context);

        if (decision.shouldIntervene) {
          console.log(`⚠️  INTERVENTION NEEDED: ${decision.reason}`);
          console.log(`💬 Sending guidance: "${decision.guidance}"`);

          try {
            await client.send(decision.guidance!);
            context.interventionCount++;
            context.consecutiveFailures = 0; // Reset after intervention

            console.log('✅ Guidance sent successfully\\n');
          } catch (error) {
            console.error('❌ Failed to send guidance:', error);
          }
        } else {
          console.log('✅ Agent is on track\\n');
        }
      }

      // Exit conditions
      if (activity.type === 'sessionCompleted') {
        console.log('\\n🎉 Session completed successfully!');
        break;
      }

      if (activity.type === 'sessionFailed') {
        console.log('\\n❌ Session failed');
        break;
      }
    }
  } catch (error) {
    console.error('\\n💥 Monitor error:', error);
  }

  console.log('\\n📊 Final Stats:');
  console.log(`   Activities observed: ${activityCount}`);
  console.log(`   Interventions made: ${context.interventionCount}`);
  console.log(`\\n👋 Monitor stopped`);
}

// Main
const sessionId = process.argv[2];

if (!sessionId) {
  console.error('Usage: bun scripts/monitor.ts <session-id>');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY not set in environment');
  process.exit(1);
}

monitorSession(sessionId).catch(console.error);
