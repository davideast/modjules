const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A simplified, robust Promise.all() with concurrency control.
 * This implementation avoids sharing an iterator, which can lead to race conditions.
 * Instead, it uses an atomic counter to safely distribute work among workers.
 *
 * @param items - Data to process.
 * @param mapper - Async function (item) => result.
 * @param options - Configuration options.
 */
export async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    stopOnError?: boolean;
    delayMs?: number;
  } = {},
): Promise<R[]> {
  const concurrency = options.concurrency ?? 3;
  const stopOnError = options.stopOnError ?? true;
  const delayMs = options.delayMs ?? 0;

  const results = new Array<R>(items.length);
  const errors: unknown[] = [];
  let currentIndex = 0;

  const worker = async () => {
    while (true) {
      const index = currentIndex++;
      if (index >= items.length) {
        break; // All items have been taken.
      }

      // This creates a delay before each batch of concurrent tasks.
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      const item = items[index];
      try {
        results[index] = await mapper(item);
      } catch (err) {
        if (stopOnError) {
          // In stopOnError mode, re-throw the error to reject the Promise.all.
          throw err;
        }
        // Otherwise, collect the error and continue.
        errors.push(err);
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());

  try {
    await Promise.all(workers);
  } catch (err) {
    // This will only be reached if stopOnError is true and a worker throws.
    // The AggregateError below will not be thrown in this case.
    throw err;
  }

  if (!stopOnError && errors.length > 0) {
    // If we're not stopping on error, throw an AggregateError with all collected errors.
    throw new AggregateError(
      errors,
      'Multiple errors occurred during pMap execution',
    );
  }

  return results;
}
