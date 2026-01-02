'# Active Session Monitor

An intelligent monitoring script that watches Jules sessions in real-time and uses Gemini Flash to detect when the agent needs help.

## Features

- **Real-time Streaming**: Monitors session activities as they happen
- **AI-Powered Analysis**: Uses Gemini 1.5 Flash to detect issues:
  - Repetitive failures
  - Thrashing (reverting changes)
  - Getting stuck or off-track
  - No meaningful progress
- **Automatic Intervention**: Sends guidance messages to get Jules back on track
- **Terminal Dashboard**: Clear, readable output showing session progress

## Setup

1. **Install Dependencies** (already done)

   ```bash
   npm install -D ai @ai-sdk/google
   ```

2. **Set Environment Variables**

   Add to your `.env` file:

   ```bash
   JULES_API_KEY=your_jules_key
   GEMINI_API_KEY=your_gemini_key
   ```

## Usage

### Start Monitoring a Session

```bash
bun scripts/monitor.ts <session-id>
```

**Example:**

```bash
# Start a new Jules session
jules run --prompt "Migrate to TypeScript 5" --repo owner/repo --branch main

# In another terminal, monitor it
bun scripts/monitor.ts abc-123-def
```

### What It Does

1. **Connects** to the specified session
2. **Streams** all activities in real-time
3. **Analyzes** every 5 activities (configurable)
4. **Detects** warning signs:
   - Command failures repeated 3+ times
   - No progress in recent activities
   - Actions that don't align with the goal
5. **Intervenes** by sending guidance messages to Jules

### Output Example

```
🔍 Starting monitor for session: abc-123-def
📋 Goal: Migrate to TypeScript 5
📊 State: IN_PROGRESS
🔗 URL: https://lab.jules.dev/sessions/abc-123-def

👀 Watching for activities...

[10:30:15] planGenerated: Plan with 4 steps
[10:30:20] planApproved: Plan approved
[10:30:45] bashOutput: Command succeeded
[10:31:12] bashOutput: Command failed (exit 1)
[10:31:45] bashOutput: Command failed (exit 1)

🤖 Analyzing session state...

⚠️  INTERVENTION NEEDED: Agent is repeatedly failing the same build command
💬 Sending guidance: "The build is failing because tsconfig.json is missing. Create it first with 'npx tsc --init'."
✅ Guidance sent successfully

[10:32:10] userMessaged: User: The build is failing...
[10:32:15] progressUpdated: Creating tsconfig.json
✅ Agent is on track

🎉 Session completed successfully!

📊 Final Stats:
   Activities observed: 15
   Interventions made: 1

👋 Monitor stopped
```

## Configuration

Edit `scripts/monitor.ts` to adjust:

```typescript
const ANALYSIS_WINDOW = 10; // Analyze last N activities
const CHECK_INTERVAL = 5; // Check every N activities
const MAX_RETRIES = 3; // Max failures before intervention
```

## Use Cases

### 1. Hands-Free Monitoring

Start a long-running Jules task and let the monitor babysit it:

```bash
# Terminal 1: Start Jules
jules run --prompt "complex task" ...

# Terminal 2: Monitor
bun scripts/monitor.ts <session-id>
```

### 2. Multi-Session Oversight

Monitor multiple sessions simultaneously:

```bash
# Monitor session 1
bun scripts/monitor.ts session-1 > logs/session-1.log &

# Monitor session 2
bun scripts/monitor.ts session-2 > logs/session-2.log &
```

### 3. CI/CD Integration

Use in automated workflows:

```bash
SESSION_ID=$(jules run --json ... | jq -r '.id')
bun scripts/monitor.ts $SESSION_ID
```

## How It Works

### Analysis Prompt

The script sends this context to Gemini:

- **Goal**: The session's objective
- **Recent Activities**: Last 10 activities with summaries
- **Consecutive Failures**: Count of recent failures

Gemini responds with:

```json
{
  "shouldIntervene": true,
  "reason": "Agent is stuck in a loop",
  "guidance": "Try checking the configuration file first"
}
```

### Decision Logic

Intervention triggers when:

1. Gemini detects an issue in the activity pattern
2. Consecutive failures reach threshold (3+)
3. Check interval is reached (every 5 activities)

## Extending the Monitor

### Add Custom Heuristics

```typescript
function needsIntervention(context: MonitoringContext): boolean {
  // Check for specific patterns
  const hasRepeatedCommands = /* ... */;
  const isReverting = /* ... */;

  return hasRepeatedCommands || isReverting;
}
```

### Auto-Approve Plans

```typescript
if (activity.type === 'planGenerated') {
  if (isSafePlan(activity.plan)) {
    await client.approve();
  }
}
```

### Send Alerts

```typescript
if (decision.shouldIntervene) {
  await sendSlackAlert(`Jules needs help: ${decision.reason}`);
  await client.send(decision.guidance);
}
```

## Tips

- **Start Small**: Monitor short sessions first to tune the settings
- **Review Logs**: Check what interventions were made
- **Adjust Temperature**: Lower (0.1-0.3) for conservative, higher (0.5-0.7) for creative
- **Cost**: Gemini Flash is very cheap (~$0.000075 per analysis)

## Troubleshooting

**Monitor exits immediately**

- Check that the session ID is valid
- Ensure `JULES_API_KEY` is set

**No interventions happening**

- Lower `MAX_RETRIES` to trigger sooner
- Reduce `CHECK_INTERVAL` to analyze more frequently

**Too many interventions**

- Increase thresholds
- Adjust Gemini prompt to be less aggressive
