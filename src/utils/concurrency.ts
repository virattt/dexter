/**
 * Async generator concurrency utilities.
 * Async generator concurrency helpers.
 */

interface QueuedGenerator<A> {
  done: boolean | undefined;
  value: A;
  generator: AsyncGenerator<A, void>;
  promise: Promise<QueuedGenerator<A>>;
}

/**
 * Run multiple async generators concurrently up to a cap, yielding values
 * as they arrive from any generator. When one generator yields, it is
 * immediately re-queued. When one finishes, a waiting generator takes its slot.
 *
 * Uses Promise.race to wake on the first available value, providing
 * natural backpressure: generators that yield frequently get re-polled
 * more often, while slow generators don't block fast ones.
 *
 * @param generators - Async generators to run concurrently
 * @param concurrencyCap - Maximum number of generators running at once (default: Infinity)
 */
export async function* all<A>(
  generators: AsyncGenerator<A, void>[],
  concurrencyCap = Infinity,
): AsyncGenerator<A, void> {
  const next = (generator: AsyncGenerator<A, void>) => {
    const promise: Promise<QueuedGenerator<A>> = generator
      .next()
      .then(({ done, value }) => ({ done, value: value as A, generator, promise }));
    return promise;
  };

  const waiting = [...generators];
  const promises = new Set<Promise<QueuedGenerator<A>>>();

  // Start initial batch up to concurrency cap
  while (promises.size < concurrencyCap && waiting.length > 0) {
    const gen = waiting.shift()!;
    promises.add(next(gen));
  }

  while (promises.size > 0) {
    const { done, value, generator, promise } = await Promise.race(promises);
    promises.delete(promise);

    if (!done) {
      // Generator yielded a value — re-queue it and yield the value
      promises.add(next(generator));
      if (value !== undefined) {
        yield value;
      }
    } else if (waiting.length > 0) {
      // Generator finished — start a waiting one
      const nextGen = waiting.shift()!;
      promises.add(next(nextGen));
    }
  }
}
