# Session Analysis Prompt

> **Purpose**: This prompt is used by an LLM (via MCP) to analyze a Jules session snapshot and provide actionable insights.

---

## Prompt Template

When calling the `jules_analyze_session` MCP tool, use this follow-up prompt to interpret the results:

```
Analyze the following Jules session snapshot and provide:

1. **Execution Summary**
   - Total duration and activity count
   - Final state and outcome (PR created? Failed?)

2. **Efficiency Analysis**
   - Time spent on implementation vs. CI fixes vs. retries
   - Identify the primary bottleneck (implementation, testing, CI, user intervention)

3. **Failure Root Causes**
   - For each sessionCompleted event after the first, explain what caused the retry
   - Categorize failures: code error, test failure, CI check, formatting, attribution, other

4. **User Intervention Analysis**
   - List each userMessaged activity with context
   - Classify as: clarification, error correction, scope change, CI feedback

5. **Recommendations**
   - What could prevent these issues in future sessions?
   - Suggested improvements to: prompt, AGENTS.md, CI configuration, or pre-commit hooks

## Session Snapshot:

{INSERT_SNAPSHOT_JSON_HERE}
```

---

## Example Analysis Output

Given a session with 3 retries due to CI attribution failures:

```markdown
## Execution Summary

- **Duration**: 44 minutes
- **Activities**: 36
- **Outcome**: PR #157 created successfully

## Efficiency Analysis

- Implementation: 12 min (27%)
- CI fixes: 32 min (73%)
- **Bottleneck**: CI configuration (attribution check)

## Failure Root Causes

| Retry | Cause                            | Category    |
| ----- | -------------------------------- | ----------- |
| 1     | Missing Co-authored-by trailer   | Attribution |
| 2     | Wrong GitHub user ID in trailer  | Attribution |
| 3     | Formatting not run before commit | Formatting  |

## User Interventions

1. [09:17] CI failure notification (attribution)
2. [09:41] Corrected user ID - automation provided wrong ID
3. [09:42] Explicit ID correction
4. [09:44] CI failure notification (formatting)

## Recommendations

1. **AGENTS.md**: Add pre-commit checklist with attribution trailer
2. **CI Automation**: Fix user ID mismatch in fix-attribution.ts
3. **Prompt**: Include `npm run format` in verification steps
```

---

## MCP Usage

```typescript
// 1. Get the snapshot
const result = await mcpClient.callTool('jules_analyze_session', {
  sessionId: '13978067286845291670',
});

// 2. Parse the JSON
const snapshot = JSON.parse(result.content[0].text);

// 3. Send to LLM with analysis prompt
const analysis = await llm.chat([
  {
    role: 'system',
    content: 'You are an expert at analyzing coding agent sessions.',
  },
  {
    role: 'user',
    content: `${ANALYSIS_PROMPT}\n\n${JSON.stringify(snapshot, null, 2)}`,
  },
]);
```

---

## Key Metrics to Extract

| Metric            | Formula                                          | Interpretation        |
| ----------------- | ------------------------------------------------ | --------------------- |
| Retry Rate        | `insights.completionAttempts - 1`                | 0 = clean run         |
| Pivot Rate        | `insights.planRegenerations - 1`                 | 0 = first plan worked |
| Intervention Rate | `insights.userInterventions / activities.length` | Lower is better       |
| CI Overhead       | Time from first completion to final              | Measures CI friction  |

---

## Session Health Score

```
Score = 100 - (10 * retries) - (5 * pivots) - (15 * interventions)

90-100: Excellent (clean run)
70-89:  Good (minor issues)
50-69:  Fair (significant rework)
< 50:   Poor (needs prompt/config improvement)
```
