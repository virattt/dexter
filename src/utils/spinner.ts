/**
 * Shared spinner for all animated components.
 *
 * One setInterval drives ALL spinners in the app. Subscribers receive
 * the current frame character on each tick. Only one requestRender()
 * fires per tick regardless of how many spinners are active.
 */

import type { TUI } from '@mariozechner/pi-tui';

const SPINNER_INTERVAL_MS = 150;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type SpinnerSubscriber = (frame: string) => void;

let interval: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;
const subscribers = new Set<SpinnerSubscriber>();
let tuiInstance: TUI | null = null;

/**
 * Initialize with the TUI instance (call once at startup).
 */
export function initSpinner(tui: TUI): void {
  tuiInstance = tui;
}

/**
 * Subscribe to spinner frame updates. Returns an unsubscribe function.
 * The interval starts on first subscriber and stops when the last unsubscribes.
 */
export function subscribeSpinner(cb: SpinnerSubscriber): () => void {
  subscribers.add(cb);

  if (!interval) {
    interval = setInterval(() => {
      frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
      const frame = SPINNER_FRAMES[frameIndex];
      for (const sub of subscribers) {
        sub(frame);
      }
      tuiInstance?.requestRender();
    }, SPINNER_INTERVAL_MS);
  }

  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

/**
 * Get the current spinner frame (for initial render before first tick).
 */
export function currentSpinnerFrame(): string {
  return SPINNER_FRAMES[frameIndex];
}
