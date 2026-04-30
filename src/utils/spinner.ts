/**
 * Shared spinner for all animated components.
 *
 * One setInterval drives ALL spinners in the app. Subscribers receive
 * the current frame character on each tick. Only one requestRender()
 * fires per tick regardless of how many spinners are active.
 */

import type { TUI } from '@mariozechner/pi-tui';

export const SPINNER_INTERVAL_MS = 50;
const FRAME_ADVANCE_MS = 120;
const FRAME_ADVANCE_TICKS = Math.max(1, Math.round(FRAME_ADVANCE_MS / SPINNER_INTERVAL_MS));
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type SpinnerSubscriber = (frame: string) => void;

let interval: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
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
      tickCount++;
      if (tickCount % FRAME_ADVANCE_TICKS === 0) {
        frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
      }
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
