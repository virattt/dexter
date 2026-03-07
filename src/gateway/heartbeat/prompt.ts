import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { HEARTBEAT_OK_TOKEN } from './suppression.js';

const HEARTBEAT_MD_PATH = join(homedir(), '.dexter', 'HEARTBEAT.md');
const PORTFOLIO_MD_PATH = join(homedir(), '.dexter', 'PORTFOLIO.md');

const DEFAULT_CHECKLIST = `- Major index moves (S&P 500, NASDAQ, Dow) — alert if any move more than 2% in a session
- Breaking financial news — major earnings surprises, Fed announcements, significant market events`;

/**
 * Load ~/.dexter/HEARTBEAT.md content.
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
 * Load ~/.dexter/PORTFOLIO.md content if it exists.
 * Used for weekly rebalance checks and quarterly reports.
 */
export async function loadPortfolioDocument(): Promise<string | null> {
  try {
    return await readFile(PORTFOLIO_MD_PATH, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if today is Monday (weekly rebalance day).
 */
function isMonday(tz = 'America/New_York'): boolean {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  return day === 'Mon';
}

/**
 * Check if today is in the first week of a quarter (Jan, Apr, Jul, Oct).
 */
function isFirstWeekOfQuarter(tz = 'America/New_York'): boolean {
  const now = new Date();
  const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now);
  const day = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(now), 10);
  const quarterMonths = ['1', '4', '7', '10'];
  return quarterMonths.includes(month) && day <= 7;
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
 * Injects date context for weekly rebalance and quarterly report scheduling.
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

  const tz = 'America/New_York';
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const isMon = isMonday(tz);
  const isQuarterStart = isFirstWeekOfQuarter(tz);

  const portfolioContent = await loadPortfolioDocument();

  let scheduleSection = '';
  if (isMon || isQuarterStart) {
    scheduleSection = `
## Portfolio Builder Schedule (run when date matches)

**Today:** ${dateStr}
**Weekly rebalance check:** ${isMon ? 'YES — run this' : 'No (runs Mondays)'}
**Quarterly performance report:** ${isQuarterStart ? 'YES — run this' : 'No (runs first week of Jan/Apr/Jul/Oct)'}

${isMon ? `### Weekly Rebalance Check
- If PORTFOLIO.md is provided below, compare current holdings to the target portfolio from your Identity (SOUL.md)
- Check: layer allocation drift, conviction-tier mix, single-position sizing, regime signals
- If rebalancing is recommended, write a concise alert with specific actions
- Use read_file to read ~/.dexter/PORTFOLIO.md if not provided` : ''}

${isQuarterStart ? `### Quarterly Performance Report
- Write a quarterly report. Performance is essential: compare portfolio returns vs (1) best hedge funds, (2) stock market indexes (S&P 500, NASDAQ), (3) BTC
- A portfolio that doesn't outperform these benchmarks is not meeting the bar
- Also include: layer attribution, conviction-tier performance, notable changes, regime assessment, outlook
- Use financial_search for current prices and performance data
- Deliver the full report to the user` : ''}
`;
  }

  const portfolioSection = portfolioContent
    ? `
## Current Portfolio (~/.dexter/PORTFOLIO.md)

${portfolioContent}
`
    : '';

  return `[HEARTBEAT CHECK]

You are running as a periodic heartbeat. Your north star is the Portfolio Builder: help the user maintain a near-perfect portfolio aligned with the thesis in your Identity.

## Checklist
${checklist}
${scheduleSection}
${portfolioSection}

## Instructions
- Use your tools to check each item on the checklist
- When it's Monday, run the weekly rebalance check (compare portfolio to target from Identity)
- When it's the first week of a quarter, write the quarterly performance report
- If you find something noteworthy, write a concise alert (or full report for quarterly)
- If nothing noteworthy is happening and no schedule items apply, respond with exactly: ${HEARTBEAT_OK_TOKEN}
- Do NOT send a message just to say "everything is fine" — only message if there's something actionable or noteworthy
- Keep alerts brief and focused — lead with the key finding
- You may combine multiple findings into one message`;
}
