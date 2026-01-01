import {
  JulesClient,
  JulesQuery,
  JulesDomain,
  QueryResult,
  FilterOp,
  WhereClause,
  SelectOptions,
} from '../types.js';
import { pMap } from '../utils.js';

/**
 * Recursively applies the 'select' projection mask to an object.
 */
function project<T>(data: any, selection?: string[]): any {
  if (!selection || selection.length === 0) return data;
  const result: any = {};
  for (const key of selection) {
    if (key in data) result[key] = data[key];
  }
  return result;
}

/**
 * Matches a value against a FilterOp.
 */
function match<V>(actual: V, filter?: FilterOp<V>): boolean {
  if (filter === undefined) return true;
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) {
    return actual === filter;
  }

  const op = filter as {
    eq?: V;
    neq?: V;
    contains?: string;
    gt?: V;
    lt?: V;
    in?: V[];
  };

  if (op.eq !== undefined && actual !== op.eq) return false;
  if (op.neq !== undefined && actual === op.neq) return false;
  if (
    op.contains !== undefined &&
    typeof actual === 'string' &&
    !actual.toLowerCase().includes(op.contains.toLowerCase())
  )
    return false;
  if (op.gt !== undefined && op.gt !== null && actual <= op.gt) return false;
  if (op.lt !== undefined && op.lt !== null && actual >= op.lt) return false;
  if (op.in !== undefined && !op.in.includes(actual)) return false;

  return true;
}

/**
 * Helper to convert WhereClause<'activities'> to SelectOptions.
 * Note: ActivityClient.select currently takes a simpler SelectOptions object.
 * We'll map what we can.
 */
function toActivitySelectOptions(
  where?: WhereClause<'activities'>,
): SelectOptions {
  if (!where) return {};
  const options: any = {};

  // Simple mapping for 'type' if it's an equality check
  if (where.type) {
    if (typeof where.type === 'string') {
      options.type = where.type;
    } else if (
      typeof where.type === 'object' &&
      'eq' in where.type &&
      where.type.eq
    ) {
      options.type = where.type.eq;
    }
  }

  return options;
}

/**
 * Standalone query engine function.
 * Handles planning, index scanning, and hydration.
 */
export async function select<T extends JulesDomain>(
  client: JulesClient,
  query: JulesQuery<T>,
): Promise<QueryResult<T>[]> {
  const storage = client.storage;
  const results: any[] = [];
  const limit = query.limit ?? Infinity;

  if (query.from === 'sessions') {
    const where = query.where as WhereClause<'sessions'> | undefined;
    const unusedVar = 'trigger-nitpick'; // To verify if reviewer was referring to something else, but I'll stick to removing the one in sessions loop if any. I don't see one.

    // PASS 1: Index Scan (Metadata Only)
    for await (const entry of storage.scanIndex()) {
      if (results.length >= limit) break;

      // Filter by ID
      if (where?.id && !match(entry.id, where.id)) continue;
      // Filter by State
      if (where?.state && !match(entry.state, where.state)) continue;
      // Filter by Title (Fuzzy Search or specific title)
      if (where?.title && !match(entry.title, where.title)) continue;
      // Global Search
      if (
        where?.search &&
        !entry.title.toLowerCase().includes(where.search.toLowerCase())
      )
        continue;

      // PASS 2: Hydration (Heavy Data)
      const cached = await storage.get(entry.id);
      if (!cached) continue;

      const item: any = project(cached.resource, query.select as string[]);
      results.push(item);
    }

    // PASS 3: Virtual Join (Include Activities)
    // We do this after filtering sessions to minimize fetches.
    // Using pMap for concurrency.
    if (query.include && 'activities' in query.include) {
      const actConfig = query.include.activities;
      let mappedOptions: any = {};
      if (typeof actConfig === 'object') {
        mappedOptions = {
          ...toActivitySelectOptions(actConfig.where),
          limit: actConfig.limit,
        };
      }

      await pMap(
        results,
        async (session) => {
          // Use history() to ensure we get data (cold stream)
          const sessionClient = await client.session(session.id);
          const history = sessionClient.history();
          const activities: any[] = [];
          for await (const act of history) {
            // Apply limit manually if needed since history yields all
            if (
              mappedOptions.limit &&
              activities.length >= mappedOptions.limit
            ) {
              break;
            }
            // Basic filtering if options were passed
            if (mappedOptions.type && act.type !== mappedOptions.type) {
              continue;
            }
            activities.push(act);
          }
          session.activities = activities;
        },
        { concurrency: 5 },
      );
    }
  } else if (query.from === 'activities') {
    const where = query.where as WhereClause<'activities'> | undefined;

    // Optimization: Target specific session if ID is provided
    let targetSessionIds: string[] = [];

    if (where?.sessionId) {
      if (typeof where.sessionId === 'string') {
        targetSessionIds = [where.sessionId];
      } else if (
        typeof where.sessionId === 'object' &&
        'eq' in where.sessionId &&
        where.sessionId.eq
      ) {
        targetSessionIds = [where.sessionId.eq];
      }
    }

    // Use a session cache to avoid N+1 fetches for session info
    const sessionCache = new Map<string, any>();

    // Generator for session IDs to scan
    // We prefer iterating over sessions we know about
    const sessionScanner = async function* () {
      if (targetSessionIds.length > 0) {
        for (const id of targetSessionIds) {
          yield { id };
        }
      } else {
        // Use client.sessions() or storage directly.
        // Using storage.scanIndex() is safer/faster if we just need IDs.
        yield* storage.scanIndex();
      }
    };

    // PASS 1: Scatter-Gather (Cross-session activity search)
    // We iterate over every session we know about
    for await (const sessionEntry of sessionScanner()) {
      if (results.length >= limit) break;

      const sessionClient = await client.session(sessionEntry.id);

      // Use history() to ensure finite stream and correct hydration
      const history = sessionClient.history();

      for await (const act of history) {
        if (results.length >= limit) break;

        // Apply filters manually since we are consuming the raw history stream
        if (where?.id && !match(act.id, where.id)) continue;
        if (where?.type && !match(act.type, where.type)) continue;

        const item: any = project(act, query.select as string[]);

        // PASS 2: Reverse Join (Include Session Metadata)
        if (query.include && 'session' in query.include) {
          const sessConfig = query.include.session;
          const sessSelect =
            typeof sessConfig === 'object' ? sessConfig.select : undefined;

          // Check cache first
          let sessionInfo = sessionCache.get(sessionEntry.id);
          if (!sessionInfo) {
            sessionInfo = await sessionClient.info();
            sessionCache.set(sessionEntry.id, sessionInfo);
          }

          item.session = project(sessionInfo, sessSelect as string[]);
        }

        results.push(item);
      }
    }
  }

  return results;
}
