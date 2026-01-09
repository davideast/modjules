import type { JulesClient } from 'modjules';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get full analysis context for a session including guidelines and snapshot.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to analyze
 * @returns Analysis content with template and snapshot JSON
 */
export async function getAnalysisContext(
  client: JulesClient,
  sessionId: string,
): Promise<string> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const session = client.session(sessionId);
  const snapshot = await session.snapshot();

  // Read template from context/session-analysis.md
  // Resolve path relative to this file: src/functions/analysis-context.ts -> ../../context/session-analysis.md
  const templatePath = path.resolve(
    __dirname,
    '../../context/session-analysis.md',
  );
  let templateContent;

  try {
    templateContent = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read prompt template at ${templatePath}. Ensure you are running from the project root.`,
    );
  }

  return templateContent.replace(
    '{INSERT_SNAPSHOT_JSON_HERE}',
    JSON.stringify(snapshot.toJSON(), null, 2),
  );
}
