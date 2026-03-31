/**
 * Priority-based message queue for mid-run user input injection.
 *
 * When the agent is busy, input surfaces (CLI, WhatsApp) enqueue messages
 * instead of dropping or serializing them. The agent drains the queue
 * between tool rounds, batching multiple messages into a single follow-up.
 */

export type QueuePriority = 'next' | 'later';

export interface QueuedMessage {
  /** The text content of the message. */
  text: string;
  /** Priority: 'next' (user input) is drained before 'later' (system/heartbeat). */
  priority: QueuePriority;
  /** Timestamp (Date.now()) when the message was enqueued. */
  enqueuedAt: number;
  /** Optional source identifier (e.g. 'cli', 'whatsapp:session-key'). */
  source?: string;
}

export type QueueSubscriber = () => void;

const PRIORITY_ORDER: Record<QueuePriority, number> = { next: 0, later: 1 };

export interface MessageQueue {
  enqueue(msg: QueuedMessage): void;
  dequeue(): QueuedMessage | undefined;
  dequeueAll(): QueuedMessage[];
  peek(): QueuedMessage | undefined;
  length(): number;
  isEmpty(): boolean;
  snapshot(): readonly QueuedMessage[];
  subscribe(listener: QueueSubscriber): () => void;
  clear(): void;
}

/**
 * Create an independent message queue instance.
 * The CLI uses the default export; the gateway creates one per session.
 */
export function createMessageQueue(): MessageQueue {
  let items: QueuedMessage[] = [];
  let frozenSnapshot: readonly QueuedMessage[] = Object.freeze([]);
  const subscribers = new Set<QueueSubscriber>();

  function notify(): void {
    frozenSnapshot = Object.freeze([...items]);
    for (const fn of subscribers) {
      fn();
    }
  }

  return {
    enqueue(msg: QueuedMessage): void {
      items.push(msg);
      notify();
    },

    dequeue(): QueuedMessage | undefined {
      if (items.length === 0) return undefined;
      // Find highest-priority item (lowest ordinal)
      let bestIdx = 0;
      for (let i = 1; i < items.length; i++) {
        if (PRIORITY_ORDER[items[i].priority] < PRIORITY_ORDER[items[bestIdx].priority]) {
          bestIdx = i;
        }
      }
      const [msg] = items.splice(bestIdx, 1);
      notify();
      return msg;
    },

    dequeueAll(): QueuedMessage[] {
      if (items.length === 0) return [];
      const drained = items.sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          a.enqueuedAt - b.enqueuedAt,
      );
      items = [];
      notify();
      return drained;
    },

    peek(): QueuedMessage | undefined {
      if (items.length === 0) return undefined;
      let bestIdx = 0;
      for (let i = 1; i < items.length; i++) {
        if (PRIORITY_ORDER[items[i].priority] < PRIORITY_ORDER[items[bestIdx].priority]) {
          bestIdx = i;
        }
      }
      return items[bestIdx];
    },

    length(): number {
      return items.length;
    },

    isEmpty(): boolean {
      return items.length === 0;
    },

    snapshot(): readonly QueuedMessage[] {
      return frozenSnapshot;
    },

    subscribe(listener: QueueSubscriber): () => void {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },

    clear(): void {
      items = [];
      notify();
    },
  };
}

/** Default queue instance for the CLI (single-session). */
export const defaultQueue: MessageQueue = createMessageQueue();
