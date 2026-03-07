import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { HEARTBEAT_OK_TOKEN } from './suppression.js';

const HEARTBEAT_MD_PATH = join(homedir(), '.dexter', 'HEARTBEAT.md');
const PORTFOLIO_MD_PATH = join(homedir(), '.dexter', 'PORTFOLIO.md');
const PORTFOLIO_HL_PATH = join(homedir(), '.dexter', 'PORTFOLIO-HYPERLIQUID.md');

const DEFAULT_CHECKLIST = `- BTC — price, dominance, any material move or news that affects HODL thesis
- HYPE — onchain stocks narrative: HIP-3, equity tokenization, Hyperliquid updates
- SOL, NEAR, SUI, ETH (Base) — agentic web4 narrative: Solana, NEAR, Sui, Base ecosystem; DePIN, agent infrastructure news
- Diversification signals — anything that changes the how/why of diversifying from BTC-heavy (e.g. AI infra cycle inflection, macro regime shift)
- Major index moves (S&P 500, NASDAQ, Dow) — alert if any move more than 2% in a session
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

const FUND_CONFIG_PATH = join(homedir(), '.dexter', 'fund-config.json');

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
 * Load ~/.dexter/PORTFOLIO-HYPERLIQUID.md content if it exists.
 * On-chain portfolio (HIP-3 tickers only); used for HL rebalance and quarterly reports.
 */
export async function loadPortfolioHLDocument(): Promise<string | null> {
  try {
    return await readFile(PORTFOLIO_HL_PATH, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Load ~/.dexter/fund-config.json if it exists.
 * Contains aum (dollars) and inceptionDate for dollar rebalancing.
 */
export async function loadFundConfig(): Promise<{ aum?: number; inceptionDate?: string } | null> {
  try {
    const content = await readFile(FUND_CONFIG_PATH, 'utf-8');
    return JSON.parse(content) as { aum?: number; inceptionDate?: string };
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

  const [portfolioContent, portfolioHLContent, fundConfig] = await Promise.all([
    loadPortfolioDocument(),
    loadPortfolioHLDocument(),
    loadFundConfig(),
  ]);

  let scheduleSection = '';
  if (isMon || isQuarterStart) {
    scheduleSection = `
## Portfolio Builder Schedule (run when date matches)

**Today:** ${dateStr}
**Weekly rebalance check:** ${isMon ? 'YES — run this' : 'No (runs Mondays)'}
**Quarterly performance report:** ${isQuarterStart ? 'YES — run this' : 'No (runs first week of Jan/Apr/Jul/Oct)'}

${isMon ? `### Weekly Rebalance Check
- **Main portfolio:** If PORTFOLIO.md is provided below, compare current holdings to the target from your Identity (SOUL.md). Check layer allocation drift, conviction-tier mix, single-position sizing.
- **Hyperliquid portfolio:** If PORTFOLIO-HYPERLIQUID.md is provided below, run a rebalance check for the on-chain portfolio. Use the "## HIP-3 Target" section from the Checklist above (if present) as the target allocation. Compare current weights to target; flag positions >5% above target; recommend trim/add (e.g. "Trim HYPE 2%, add to SOL").
- **Regime label:** Fetch 7-day move for BTC-USD, GLD, SPY. Output one line: Regime: risk-on / risk-off / mixed. Basis: [brief reason from benchmark direction]
- **Concentration alerts:** For both portfolios, flag any position >5% above its target weight. Recommend specific trim/add actions.
- **Dollar rebalancing:** If ~/.dexter/fund-config.json has aum set, output rebalance actions in dollar amounts for the main portfolio. Use fund_config tool to read aum if needed.
- **Weekly newsletter draft:** If noteworthy (material moves, regime shift, rebalance needed), draft a 150–250 word Substack snippet. Save to ~/.dexter/WEEKLY-DRAFT-YYYY-MM-DD.md via save_report. Include both portfolios when both exist. Voice: structural, precise numbers, no hype (see VOICE.md)
- If rebalancing is recommended, write a concise alert with specific actions
- Use read_file to read ~/.dexter/PORTFOLIO.md or PORTFOLIO-HYPERLIQUID.md if not provided` : ''}

${isQuarterStart ? `### Quarterly Performance Report
- **Main portfolio:** Write a quarterly report for PORTFOLIO.md. Performance is essential: compare returns vs (1) best hedge funds, (2) stock market indexes (S&P 500, NASDAQ), (3) BTC. Include layer attribution, conviction-tier performance, regime assessment, outlook. MANDATORY: Save to ~/.dexter/QUARTERLY-REPORT-YYYY-QN.md via save_report.
- **Hyperliquid portfolio:** If PORTFOLIO-HYPERLIQUID.md exists, write a SEPARATE quarterly report for it. Include: portfolio return vs BTC, SPY, GLD (and hl_basket if computable via HYPERLIQUID-SYMBOL-MAP.md), category attribution (Core, L1, AI infra, tokenization), best/worst performers, regime, outlook. MANDATORY: Save to ~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md via save_report.
- **YTD and since-inception:** Call performance_history view. If inceptionDate in fund-config exists, compute since-inception. Include in both reports.
- **Performance history:** Call performance_history record_quarter with period (e.g. 2026-Q1), portfolio, btc, spy, gld as decimals. If PORTFOLIO-HYPERLIQUID.md exists, compute portfolio_hl and include it; optionally compute hl_basket if feasible.
- Use financial_search for prices. Map HL symbols to FD tickers per docs/HYPERLIQUID-SYMBOL-MAP.md for HL positions.
- Deliver the full report(s) to the user` : ''}
`;
  }

  const portfolioSection = portfolioContent
    ? `
## Current Portfolio (~/.dexter/PORTFOLIO.md)

${portfolioContent}
`
    : '';

  const portfolioHLSection = portfolioHLContent
    ? `
## Hyperliquid Portfolio (~/.dexter/PORTFOLIO-HYPERLIQUID.md)

On-chain portfolio (HIP-3 tickers). For weekly rebalance: use the "## HIP-3 Target" section from the Checklist above as target allocation. For quarterly: write a dedicated report and save to QUARTERLY-REPORT-HL-YYYY-QN.md.

${portfolioHLContent}
`
    : '';

  const fundConfigSection =
    fundConfig && (fundConfig.aum ?? fundConfig.inceptionDate)
      ? `
## Fund Config (~/.dexter/fund-config.json)

AUM: ${fundConfig.aum != null ? `$${fundConfig.aum.toLocaleString()}` : 'not set'}
Inception: ${fundConfig.inceptionDate ?? 'not set'}
`
      : '';

  return `[HEARTBEAT CHECK]

You are running as a periodic heartbeat. Your north star is the Portfolio Builder: help the user maintain a near-perfect portfolio aligned with the thesis in your Identity.

## Checklist
${checklist}
${scheduleSection}
${portfolioSection}
${portfolioHLSection}
${fundConfigSection}

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
