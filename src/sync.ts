import { JulesClient, SessionResource, StorageFactory } from './types.js';
import { SessionStorage } from './storage/interface.js';
import { collectAsync } from './utils.js';

export interface SyncStats {
  sessionsIngested: number;
  activitiesIngested: number;
  isComplete: boolean;
  durationMs: number;
}

export async function hydrateActivities(
  client: JulesClient,
  storageFactory: StorageFactory,
  sessionStorage: SessionStorage,
  session: SessionResource,
  incremental: boolean,
): Promise<number> {
  const sessionClient = client.session(session.id);
  const highWaterMark = await sessionStorage.getActivityHighWaterMark(
    session.id,
  );

  if (highWaterMark && incremental) {
    const newActivities = [];
    for await (const activity of await sessionClient.history()) {
      if (activity.createTime > highWaterMark) {
        newActivities.push(activity);
      } else {
        break;
      }
    }
    newActivities.reverse();
    await sessionStorage.appendActivities(session.id, newActivities);
    return newActivities.length;
  } else {
    const allActivities = await collectAsync(sessionClient.history());
    allActivities.reverse();
    await sessionStorage.writeActivities(session.id, allActivities);
    return allActivities.length;
  }
}
