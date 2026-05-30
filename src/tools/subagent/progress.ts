/**
 * Live progress protocol for delegated subagents.
 *
 * A subagent's tool-use count, token estimate, and current activity live in its
 * event stream (tool layer), but the row that displays them is in the UI layer.
 * The only live link between the two is the tool's onProgress string channel, so
 * we ship a small structured payload over it: the handler encodes, the UI decodes.
 */
export interface SubagentProgress {
  /** Number of tools the subagent has invoked so far. */
  toolUseCount: number;
  /** Token estimate (live) or precise total (on completion); null until known. */
  tokens: number | null;
  /** Short rolled-up activity, e.g. "Ran get_financials" or "Searched 3×, read 2 sources". */
  activity: string;
  /** True on the final emit, when tokens is the precise total. */
  done?: boolean;
}

// Control-char sentinel so a structured payload never collides with a plain
// progress string (and never renders as visible text if mishandled).
const PREFIX = 'subagent-progress';

export function encodeSubagentProgress(progress: SubagentProgress): string {
  return PREFIX + JSON.stringify(progress);
}

export function decodeSubagentProgress(message: string): SubagentProgress | null {
  if (!message.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as SubagentProgress;
    if (typeof parsed.toolUseCount === 'number' && typeof parsed.activity === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
