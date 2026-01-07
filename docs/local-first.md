# Local-First Cache

The `modjules` SDK is designed to be fast and reliable, even on a slow or intermittent network connection. It achieves this with a **local-first cache**. All your session data is automatically stored on your local machine, which means you can query and read it instantly, without waiting for a network round trip.

## Example: Instantly Querying Past Events

Need to find the last 10 times a session failed? Or get all the bash commands a session ran? You can query the local cache for this information instantly using `jules.select()`. This is incredibly fast because it reads directly from your local disk and doesn't make a network call.

```typescript
import { jules } from 'modjules';

async function findRecentErrors() {
  console.log('Searching for recent session failures...');

  // This query runs entirely against the local cache.
  const failedActivities = await jules.select({
    from: 'activities', // This is the default
    where: {
      type: 'sessionFailed',
    },
    orderBy: {
      field: 'createTime',
      direction: 'desc',
    },
    limit: 10,
  });

  if (failedActivities.length > 0) {
    console.log(`Found ${failedActivities.length} recent failures:`);
    for (const activity of failedActivities) {
      console.log(`- Session ${activity.sessionId}: ${activity.reason}`);
    }
  } else {
    console.log('No recent failures found in the cache.');
  }
}

findRecentErrors();
```

## How It Works

As you interact with sessions, the SDK automatically downloads and caches all activities in the background. In Node.js, this is stored in a `.jules/` directory in your project. In the browser, it uses IndexedDB.

This means that the next time you need that data, it's already there, ready to be read instantly.

## Choosing the Right Stream

The local cache also powers the different streaming methods:

-   `session.stream()`: **The default and recommended stream.** It gives you the best of both worlds: it first yields all the activities from the local cache (instantly), and then stays connected to the network to stream any live, real-time updates as they happen.

-   `session.history()`: **Local cache only.** This stream reads all the activities from the cache and then closes. It's perfect for when you need to quickly "replay" a session's history for analysis and don't care about live updates. It works offline.

-   `session.updates()`: **Network only.** This stream ignores the local cache and only shows you live events from the network from the moment you connect.

## Manual Synchronization

If you want to be sure you have the absolute latest data from the server before running a local query, you can manually trigger a sync.

```typescript
// Fetch all new sessions and activities from the server.
await jules.sync();

// Now your local queries will include the latest information.
const allSessions = await jules.select({ from: 'sessions' });
```
