import { getAllSchemas, generateMarkdownDocs } from 'modjules';
import type { SchemaResult, SchemaFormat, SchemaDomain } from './types.js';

/**
 * Get the Jules Query Language (JQL) schema.
 *
 * @param domain - Domain to get schema for: 'sessions', 'activities', or 'all'
 * @param format - Output format: 'json' or 'markdown'
 * @returns Schema content in the requested format
 */
export function getSchema(
  domain: SchemaDomain = 'all',
  format: SchemaFormat = 'json',
): SchemaResult {
  if (format === 'markdown') {
    return {
      content: generateMarkdownDocs(),
      format: 'markdown',
    };
  }

  // JSON format
  const schemas = getAllSchemas();
  let content: object;

  if (domain === 'sessions') {
    content = {
      sessions: schemas.sessions,
      filterOps: schemas.filterOps,
      projection: schemas.projection,
    };
  } else if (domain === 'activities') {
    content = {
      activities: schemas.activities,
      filterOps: schemas.filterOps,
      projection: schemas.projection,
    };
  } else {
    content = schemas;
  }

  return {
    content,
    format: 'json',
  };
}
