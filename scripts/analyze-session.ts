#!/usr/bin/env npx tsx
// scripts/analyze-session.ts
// Analyze a Jules session using the modjules library

import { connect, Activity } from '../src/index.js';

const SESSION_ID = process.argv[2] || '11176201686740451320';

async function main() {
  console.log(`Analyzing session: ${SESSION_ID}\n`);

  const client = connect();
  const session = client.session(SESSION_ID);

  // Get session info first
  const info = await session.info();
  console.log(`Session State: ${info.state}`);
  console.log(`URL: ${info.url}\n`);

  // FORCE hydrate to sync from network
  console.log('Forcing hydrate() to sync from network...');
  const newCount = await session.hydrate();
  console.log(`Hydrated ${newCount} new activities from network\n`);

  // Get ALL activities via history() iterator
  console.log('Fetching all activities via history()...\n');
  const allActivities: Activity[] = [];
  for await (const activity of session.history()) {
    allActivities.push(activity);
  }
  console.log(`Total activities from history(): ${allActivities.length}\n`);

  // Now get snapshot for comparison
  console.log('Fetching snapshot...\n');
  const snapshot = await session.snapshot();
  console.log(`Total activities in snapshot: ${snapshot.activities.length}\n`);

  // Output key information
  console.log('='.repeat(60));
  console.log(`Session: ${snapshot.title}`);
  console.log(`State: ${snapshot.state}`);
  console.log(`URL: ${snapshot.url}`);
  console.log('='.repeat(60));

  console.log('\n--- Overview ---');
  console.log(`Created: ${snapshot.createdAt.toISOString()}`);
  console.log(`Updated: ${snapshot.updatedAt.toISOString()}`);
  console.log(
    `Duration: ${Math.round(snapshot.durationMs / 1000 / 60)} minutes`,
  );
  console.log(`Total Activities: ${snapshot.activities.length}`);

  if (snapshot.pr) {
    console.log(`\n--- Pull Request ---`);
    console.log(`Title: ${snapshot.pr.title}`);
    console.log(`URL: ${snapshot.pr.url}`);
  }

  console.log('\n--- Activity Counts ---');
  for (const [type, count] of Object.entries(snapshot.activityCounts)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\n--- Insights ---');
  console.log(`  Completion Attempts: ${snapshot.insights.completionAttempts}`);
  console.log(`  Plan Regenerations: ${snapshot.insights.planRegenerations}`);
  console.log(`  User Interventions: ${snapshot.insights.userInterventions}`);
  console.log(`  Failed Commands: ${snapshot.insights.failedCommands.length}`);

  if (snapshot.insights.failedCommands.length > 0) {
    console.log('\n--- Failed Commands ---');
    for (const activity of snapshot.insights.failedCommands) {
      const bashArtifact = activity.artifacts.find(
        (a) => a.type === 'bashOutput',
      );
      if (bashArtifact && bashArtifact.type === 'bashOutput') {
        console.log(`  Command: ${bashArtifact.command}`);
        console.log(`  Exit Code: ${bashArtifact.exitCode}`);
      }
    }
  }

  console.log('\n--- Recent Timeline (last 10) ---');
  const recentTimeline = snapshot.timeline.slice(-10);
  for (const entry of recentTimeline) {
    const time = new Date(entry.time).toLocaleTimeString();
    console.log(`  [${time}] ${entry.type}: ${entry.summary.substring(0, 80)}`);
  }

  // Show BOTH first and last activities to understand ordering
  console.log('\n--- FIRST Activity (index 0) ---');
  const firstActivity = allActivities[0];
  if (firstActivity) {
    console.log(`Type: ${firstActivity.type}`);
    console.log(`Time: ${firstActivity.createTime}`);
    console.log(`Originator: ${firstActivity.originator}`);
    if ('message' in firstActivity) {
      console.log(`\nMessage:\n${(firstActivity as any).message}`);
    }
    console.log('\nRaw JSON:');
    console.log(JSON.stringify(firstActivity, null, 2));
  }

  console.log('\n--- LAST Activity (index -1) ---');
  const lastActivity = allActivities[allActivities.length - 1];
  if (lastActivity) {
    console.log(`Type: ${lastActivity.type}`);
    console.log(`Time: ${lastActivity.createTime}`);
    console.log(`Originator: ${lastActivity.originator}`);

    // Show message content if it's a message type
    if ('message' in lastActivity) {
      console.log(`\nMessage:\n${(lastActivity as any).message}`);
    }

    // Show artifacts
    if (lastActivity.artifacts.length > 0) {
      console.log(`\nArtifacts (${lastActivity.artifacts.length}):`);
      for (const artifact of lastActivity.artifacts) {
        console.log(`  - Type: ${artifact.type}`);
        if (artifact.type === 'bashOutput') {
          console.log(`    Command: ${artifact.command}`);
          console.log(`    Exit Code: ${artifact.exitCode}`);
        }
      }
    }

    // Raw JSON for full visibility
    console.log('\nRaw JSON:');
    console.log(JSON.stringify(lastActivity, null, 2));
  }
}

main().catch(console.error);
