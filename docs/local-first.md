# Local-first Synchronization

The Jules SDK is more than just a simple API wrapper; it's a powerful toolkit for building robust, agent-ready applications. A core part of this is the **local-first synchronization engine**, which ensures that your application is fast, reliable, and capable of working offline.

## What is Local-first?

Local-first applications store and manage data on the local device first, and then synchronize with a remote server in the background. This approach offers several key advantages:

- **Performance:** Data is read from a local cache, which is significantly faster than fetching it over a network. This results in a highly responsive user experience.
- **Reliability:** The application can continue to function even if the network connection is slow, intermittent, or completely unavailable.
- **Offline Capabilities:** Users can interact with the application and its data even when they are offline. Changes are queued and synchronized once a connection is re-established.

## The `ActivityClient`

The local-first synchronization engine is exposed through the `ActivityClient`, which is accessible via the `session.activities()` method. The `ActivityClient` automatically caches all session activities to your local disk, providing a fast and resilient way to interact with session data.

This design shifts the SDK from a simple API wrapper to a stateful client that keeps a local replica of your session's activity history.

### Key Features:

- **Automatic Caching:** All activities are written to a local database, ensuring that you have a complete history of the session, even across application restarts.
- **Robust Streaming:** The `.stream()` method provides a hybrid stream that combines historical data from the local cache with live updates from the network, offering a seamless and restart-safe way to observe session progress.
- **Rich Local Querying:** The `.select()` method allows you to perform complex queries on the local cache without any network latency, enabling you to build powerful, data-driven features.
