/**
 * The internal engine for jules.all()
 *
 * @param items - Data to process
 * @param mapper - Async function (item) => result
 * @param options - Configuration options
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
  const concurrency = options.concurrency ?? 4;
  const stopOnError = options.stopOnError ?? true;
  const delayMs = options.delayMs ?? 0;

  const results = new Array<R>(items.length);
  const errors = new Array<Error | unknown>();
  const iterator = items.entries();

  const workers = new Array(concurrency).fill(iterator).map(async (i) => {
    for (const [index, item] of i) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        results[index] = await mapper(item);
      } catch (err) {
        if (stopOnError) {
          throw err;
        }
        errors.push(err);
      }
    }
  });

  await Promise.all(workers);

  if (!stopOnError && errors.length > 0) {
    throw new AggregateError(errors, 'Multiple errors occurred during jules.all()');
  }

  return results;
}
