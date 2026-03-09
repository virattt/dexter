import { readFile } from 'node:fs/promises';
import { HEARTBEAT_OK_TOKEN } from './suppression.js';
import { dexterPath } from '../../utils/paths.js';
import { isAIHFConfigured } from '../../tools/aihf/index.js';

const HEARTBEAT_MD_PATH = dexterPath('HEARTBEAT.md');
const PORTFOLIO_MD_PATH = dexterPath('PORTFOLIO.md');
const PORTFOLIO_HL_PATH = dexterPath('PORTFOLIO-HYPERLIQUID.md');

const DEFAULT_CHECKLIST = `- BTC — price, dominance, any material move or news that affects HODL thesis
- HYPE — onchain stocks narrative: HIP-3, equity tokenization, Hyperliquid updates
- SOL, NEAR, SUI, ETH (Base) — agentic web4 narrative: Solana, NEAR, Sui, Base ecosystem; DePIN, agent infrastructure news
- Diversification signals — anything that changes the how/why of diversifying from BTC-heavy (e.g. AI infra cycle inflection, macro regime shift)
- Major index moves (S&P 500, NASDAQ, Dow) — alert if any move more than 2% in a session
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

const FUND_CONFIG_PATH = dexterPath('fund-config.json');

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
- **Hyperliquid portfolio:** If HL account is connected (hyperliquid_positions / hyperliquid_sync_portfolio available), call hyperliquid_sync_portfolio with write_to_file=true first to refresh PORTFOLIO-HYPERLIQUID.md from live positions, then call hyperliquid_portfolio_ops with action=rebalance_check. Otherwise use PORTFOLIO-HYPERLIQUID.md as provided below. Then call hyperliquid_order_preview to get reviewable order intents; present the preview and concise trim/add recommendations (e.g. "Trim HYPE 2%, add to SOL"). Target comes from HEARTBEAT.md "## HIP-3 Target" (Ticker | TargetMin | TargetMax | Category | Notes). When suggesting new HL positions, size by thesis conviction, not by volume (volume matters for execution, not allocation). **Do NOT submit any HL orders in heartbeat — preview and alert only.** Never call any HL submit or cancel tool from heartbeat.
- **Regime label:** Fetch 7-day move for BTC-USD, GLD, SPY. Output one line: Regime: risk-on / risk-off / mixed. Basis: [brief reason from benchmark direction]
- **Concentration alerts:** For both portfolios, flag any position >5% above its target weight. Recommend specific trim/add actions.
- **Dollar rebalancing:** If ~/.dexter/fund-config.json has aum set, output rebalance actions in dollar amounts for the main portfolio. If aum_hl is set, hyperliquid_portfolio_ops rebalance_check returns suggestedDollar per HL trim/add action — use those for HL sleeve dollar recommendations. Use fund_config tool to read aum / aum_hl if needed.
- **Weekly newsletter draft:** If noteworthy (material moves, regime shift, rebalance needed), draft a 150–250 word Substack snippet. Save to ~/.dexter/WEEKLY-DRAFT-YYYY-MM-DD.md via save_report. Include both portfolios when both exist. Voice: structural, precise numbers, no hype (see VOICE.md)
- If rebalancing is recommended, write a concise alert with specific actions
- Use read_file to read ~/.dexter/PORTFOLIO.md or PORTFOLIO-HYPERLIQUID.md if not provided` : ''}

${isQuarterStart ? `### Quarterly Performance Report
- **Main portfolio:** Write a quarterly report for PORTFOLIO.md. Performance is essential: compare returns vs (1) best hedge funds, (2) stock market indexes (S&P 500, NASDAQ), (3) BTC. Include layer attribution, conviction-tier performance, regime assessment, outlook. MANDATORY: Save to ~/.dexter/QUARTERLY-REPORT-YYYY-QN.md via save_report.
- **Hyperliquid portfolio:** If HL account is connected, call hyperliquid_sync_portfolio with write_to_file=true first so quarterly summary uses live holdings; then if PORTFOLIO-HYPERLIQUID.md exists, call hyperliquid_portfolio_ops with action=quarterly_summary and period=YYYY-QN (e.g. 2026-Q1). Use the returned quarterly payload (portfolio_hl, hl_basket) with performance_history record_quarter (along with portfolio, btc, spy, gld). Then write a SEPARATE quarterly report: portfolio return vs BTC, SPY, GLD, hl_basket; category attribution; regime, outlook. MANDATORY: Save to ~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md via save_report.
- **YTD and since-inception:** Call performance_history view (or summary/ytd/since_inception when available). If inceptionDate in fund-config exists, compute since-inception. Include in both reports.
- **Performance history:** Use hyperliquid_portfolio_ops quarterly_summary for HL decimals, or hyperliquid_performance; then pass to performance_history record_quarter.
- Use financial_search for prices; for HL use hyperliquid_prices for pre-IPO or HL-native prices.
- Deliver the full report(s) to the user
${isAIHFConfigured() ? `- **AIHF Double-Check:** After saving the quarterly report(s), run the aihf_double_check tool with action=run. It reads PORTFOLIO.md and PORTFOLIO-HYPERLIQUID.md automatically. Include the summary (agreement %, conflicts, excluded-but-interesting) in your heartbeat alert. The full report is saved to .dexter/AIHF-DOUBLE-CHECK-YYYY-MM-DD.md automatically.` : ''}` : ''}
`;
  }

  const portfolioSection = portfolioContent
    ? `
## Current Portfolio (~/.dexter/PORTFOLIO.md)

${portfolioContent}
`
    : '';

  const hlAccountConfigured = /^0x[a-fA-F0-9]{40}$/.test(
    String(process.env.HYPERLIQUID_ACCOUNT_ADDRESS ?? '').trim(),
  );
  const portfolioHLSection = portfolioHLContent
    ? `
## Hyperliquid Portfolio (~/.dexter/PORTFOLIO-HYPERLIQUID.md)

On-chain portfolio (HIP-3 tickers). For weekly rebalance: use the "## HIP-3 Target" section from the Checklist above as target allocation. For quarterly: write a dedicated report and save to QUARTERLY-REPORT-HL-YYYY-QN.md.
${hlAccountConfigured ? '\n**Live sync:** HL account is configured. Prefer calling hyperliquid_sync_portfolio with write_to_file=true before rebalance_check or quarterly_summary so ops use current on-chain positions.\n' : ''}

${portfolioHLContent}
`
    : hlAccountConfigured
      ? `
## Hyperliquid (live sync available)

HL account is configured (HYPERLIQUID_ACCOUNT_ADDRESS). For HL rebalance or quarterly report: call hyperliquid_sync_portfolio with write_to_file=true first to refresh ~/.dexter/PORTFOLIO-HYPERLIQUID.md from live positions, then run hyperliquid_portfolio_ops (rebalance_check or quarterly_summary).
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

  const tastytradeHeartbeatEnabled =
    process.env.TASTYTRADE_HEARTBEAT_ENABLED === 'true' && process.env.TASTYTRADE_CLIENT_ID;
  const tastytradeSection = tastytradeHeartbeatEnabled
    ? `
## Tastytrade drift check (optional)

If tastytrade is connected, call tastytrade_positions and tastytrade_balances to get live broker positions. Compare to the target from Identity (SOUL.md) and PORTFOLIO.md (Target column). **Drift thresholds:** Flag any position >5% above target weight (e.g. "NVDA 8% vs 5% target — consider trimming") OR >3% below target for Core Compounders (e.g. "AAPL 4% vs 7% target — consider adding"). You may use tastytrade_sync_portfolio to build a current table with Target/Actual/Gap first, then compare.

**Theta check:** Call tastytrade_position_risk (and tastytrade_positions if needed) to list short options. Flag any expiring in the next 7 days and mention roll or repair where appropriate (user can run /theta-roll or /theta-repair in chat; do not submit orders from heartbeat).
**Do NOT submit or cancel tastytrade orders from heartbeat — drift check and theta alert only.**
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
${tastytradeSection}

## Instructions
- Use your tools to check each item on the checklist
- **Cross-venue overlap:** PORTFOLIO.md (tastytrade sleeve) must have zero overlap with the Hyperliquid tradable universe. If PORTFOLIO.md contains any ticker tradable on Hyperliquid (e.g. AAPL, MSFT, AMZN, META, COIN, BTC, SOL, ETH, SUI, NEAR), report it as a policy violation and recommend moving those to PORTFOLIO-HYPERLIQUID.md. Flag any such contamination in your alert.
- When it's Monday, run the weekly rebalance check (compare portfolio to target from Identity)
- When it's the first week of a quarter, write the quarterly performance report
- If you find something noteworthy, write a concise alert (or full report for quarterly)
- If nothing noteworthy is happening and no schedule items apply, respond with exactly: ${HEARTBEAT_OK_TOKEN}
- Do NOT send a message just to say "everything is fine" — only message if there's something actionable or noteworthy
- Keep alerts brief and focused — lead with the key finding
- You may combine multiple findings into one message`;
}
