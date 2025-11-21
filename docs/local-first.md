# Local-first Synchronization

The Jules SDK is more than just a simple API wrapper; it's a powerful toolkit for building robust, agent-ready applications. A core part of this is the **local-first synchronization engine**, which ensures that your application is fast, reliable, and capable of working offline.

## What is Local-first?

Local-first applications store and manage data on the local device first, and then synchronize with a remote server in the background. This approach offers several key advantages:

- **Performance:** Data is read from a local cache, which is significantly faster than fetching it over a network. This results in a highly responsive user experience.
- **Reliability:** The application can continue to function even if the network connection is slow, intermittent, or completely unavailable.
- **Offline Capabilities:** Users can interact with the application and its data even when they are offline. Changes are queued and synchronized once a connection is re-established.

## Accessing Session Data

The SDK provides three primary methods for accessing session data, each tailored to a different use case.

### `session.stream()`

This is the recommended method for most applications. It provides a robust, restart-safe stream of all session activities. It seamlessly combines a complete history of locally cached activities with live updates from the network.

```typescript
for await (const activity of session.stream()) {
  console.log(activity.type);
}
```

### `session.select()`

The local cache can be queried instantly without network latency using the `session.select()` method. This is a powerful feature for building applications that need to quickly access and analyze historical session data.

```typescript
// Query your local cache instantly without network latency.
const errors = await session.select({
  type: 'sessionFailed',
  limit: 10,
});
```

### `session.history()`

If you only need to access the activities that are already stored in the local cache, you can use the `session.history()` method. This is useful for quickly replaying the history of a session without waiting for live updates.

```typescript
for await (const activity of session.history()) {
  console.log(activity.type);
}
```

### `session.updates()`

For applications that only need to react to new, live events, the `session.updates()` method provides a stream of activities from the network. This is ideal for building real-time user interfaces or services that don't need to process historical data.

```typescript
for await (const activity of session.updates()) {
  console.log(activity.type);
}
```
