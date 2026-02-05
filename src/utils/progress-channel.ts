/**
 * Lightweight async-iterable queue for streaming progress messages
 * from subagent tools back to the agent event loop in real-time.
 *
 * Tools call `emit()` to push messages; the agent drains the channel
 * via `for await...of` and yields ToolProgressEvents to the UI.
 */
export interface ProgressChannel {
  /** Push a progress message into the channel */
  emit: (message: string) => void;
  /** Signal that no more messages will be emitted */
  close: () => void;
  /** Async iterable interface for draining messages */
  [Symbol.asyncIterator](): AsyncIterator<string>;
}

/**
 * Create a progress channel that bridges synchronous `emit()` calls
 * from inside a tool to the async generator that the agent drains.
 *
 * Uses a simple buffer + pending-resolver pattern:
 * - If the consumer is waiting (no buffered items), `emit()` resolves
 *   the pending promise immediately.
 * - If the consumer is busy, messages buffer until the next `next()` call.
 * - `close()` marks the channel as done; the iterator terminates after
 *   draining any remaining buffered items.
 */
export function createProgressChannel(): ProgressChannel {
  const buffer: string[] = [];
  let closed = false;
  let pendingResolve: ((value: IteratorResult<string>) => void) | null = null;

  const emit = (message: string) => {
    if (closed) return;

    if (pendingResolve) {
      // Consumer is waiting -- deliver immediately
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ value: message, done: false });
    } else {
      // Consumer is busy -- buffer for later
      buffer.push(message);
    }
  };

  const close = () => {
    closed = true;

    // If the consumer is waiting and nothing is buffered, signal done
    if (pendingResolve && buffer.length === 0) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ value: undefined as unknown as string, done: true });
    }
  };

  const asyncIterator: AsyncIterator<string> = {
    next(): Promise<IteratorResult<string>> {
      // Drain buffered items first
      if (buffer.length > 0) {
        return Promise.resolve({ value: buffer.shift()!, done: false });
      }

      // Nothing buffered and channel is closed -- we're done
      if (closed) {
        return Promise.resolve({ value: undefined as unknown as string, done: true });
      }

      // Nothing buffered, channel still open -- wait for next emit or close
      return new Promise<IteratorResult<string>>((resolve) => {
        pendingResolve = resolve;
      });
    },
  };

  return {
    emit,
    close,
    [Symbol.asyncIterator]() {
      return asyncIterator;
    },
  };
}
