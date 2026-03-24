import { readFile } from 'node:fs/promises';
import { HEARTBEAT_OK_TOKEN } from './suppression.js';
import { dexterPath } from '../../utils/paths.js';

const HEARTBEAT_MD_PATH = dexterPath('HEARTBEAT.md');

const DEFAULT_CHECKLIST = `- Major index moves (S&P 500, NASDAQ, Dow) — alert if any move more than 2% in a session
- Breaking financial news — major earnings surprises, Fed announcements, significant market events`;

/**
 * Load .dexter/HEARTBEAT.md content.
 * Returns the content string, or null if the file doesn't exist.
 */
export async function loadHeartbeatDocument(): Promise<string | null> {
  try {
    return await readFile(HEARTBEAT_MD_PATH, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if heartbeat content is effectively empty
 * (only headers, whitespace, or empty list items).
 */
export function isHeartbeatContentEmpty(content: string): boolean {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headers, and empty list items
    if (!trimmed) continue;
    if (/^#+\s*$/.test(trimmed)) continue;
    if (/^#+\s/.test(trimmed)) continue;
    if (/^[-*]\s*$/.test(trimmed)) continue;
    // Non-empty content found
    return false;
  }
  return true;
}

/**
 * Build the heartbeat query to send to the agent.
 * Returns null if the file exists but is empty (skip heartbeat).
 * Uses a default checklist if no file exists.
 */
export async function buildHeartbeatQuery(): Promise<string | null> {
  const content = await loadHeartbeatDocument();

  let checklist: string;
  if (content !== null) {
    if (isHeartbeatContentEmpty(content)) {
      return null; // File exists but is empty — skip heartbeat
    }
    checklist = content;
  } else {
    checklist = DEFAULT_CHECKLIST;
  }

  return `[HEARTBEAT CHECK]

You are running as a periodic heartbeat. Review the following checklist and check if anything noteworthy has happened that the user should know about.

## Checklist
${checklist}

## Instructions
- Use your tools to check each item on the checklist
- If you find something noteworthy, write a concise alert message for the user
- If nothing noteworthy is happening, respond with exactly: ${HEARTBEAT_OK_TOKEN}
- Do NOT send a message just to say "everything is fine" — only message if there's something actionable or noteworthy
- Keep alerts brief and focused — lead with the key finding
- You may combine multiple findings into one message`;
}
