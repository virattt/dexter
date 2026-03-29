import { Container, ProcessTerminal, Spacer, Text, TUI, type SlashCommand } from '@mariozechner/pi-tui';
import { AtPathAutocompleteProvider } from './components/at-path-provider.js';
import type {
  ApprovalDecision,
  ReasoningEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from './agent/index.js';
import { DEFAULT_MAX_ITERATIONS } from './agent/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';
import { logger } from './utils/logger.js';
import { callLlm, isThinkingModel } from './model/llm.js';
import { MemoryManager } from './memory/index.js';
import {
  AgentRunnerController,
  InputHistoryController,
  ModelSelectionController,
} from './controllers/index.js';
import { SessionController } from './controllers/session-controller.js';
import { WatchlistController, parseWatchlistSubcommand } from './controllers/watchlist-controller.js';
import {
  buildAsciiBar,
  buildEnrichedEntries,
  buildSnapshotDisplayData,
  calcPortfolioTotals,
  fetchLivePrices,
} from './controllers/watchlist-display.js';
import type { PriceFetcher, PriceSnapshot } from './controllers/watchlist-display.js';
import { api } from './tools/finance/api.js';
import { MemoryStore } from './memory/store.js';
import { runDream, incrementDreamSessionCount, shouldRunDream } from './memory/dream.js';
import { seedWatchlistEntries } from './memory/auto-store.js';
import {
  ApiKeyInputComponent,
  ApprovalPromptComponent,
  ChatLogComponent,
  CustomEditor,
  DebugPanelComponent,
  IntroComponent,
  WorkingIndicatorComponent,
  createApiKeyConfirmSelector,
  createModelSelector,
  createProviderSelector,
  createSessionSelector,
  createSkillSelector,
} from './components/index.js';
import { editorTheme, theme } from './theme.js';
import type { HistoryItem } from './types.js';
import { formatDuration, formatExchangeForScrollback } from './utils/scrollback.js';
import { exportSession } from './utils/export.js';
import type { SessionIndexEntry } from './utils/session-store.js';
import type { SessionLlmMessage } from './utils/session-store.js';
import { discoverSkills } from './skills/registry.js';
import type { SkillMetadata } from './skills/types.js';
import { getSetting, setSetting, validateConfigValue } from './utils/config.js';

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) {
    return `${str.slice(0, lastSpace)}...`;
  }
  return `${str.slice(0, maxLength)}...`;
}

function summarizeToolResult(tool: string, args: Record<string, unknown>, result: string): string {
  if (tool === 'skill') {
    const skillName = args.skill as string;
    return `Loaded ${skillName} skill`;
  }
  try {
    const parsed = JSON.parse(result);
    if (parsed.data) {
      if (Array.isArray(parsed.data)) {
        return `Received ${parsed.data.length} items`;
      }
      if (typeof parsed.data === 'object') {
        const keys = Object.keys(parsed.data).filter((key) => !key.startsWith('_'));
        if (tool === 'get_financials' || tool === 'get_market_data' || tool === 'stock_screener') {
          return keys.length === 1 ? 'Called 1 data source' : `Called ${keys.length} data sources`;
        }
        if (tool === 'web_search') {
          return 'Did 1 search';
        }
        return `Received ${keys.length} fields`;
      }
    }
  } catch {
    return truncateAtWord(result, 50);
  }
  return 'Received data';
}


/**
 * Writes a brief LLM summary of the current session to today's daily memory file.
 * This ensures Dream has meaningful input to consolidate even when the context-
 * overflow threshold is never reached (the usual case for shorter sessions).
 * Skips silently if there are no exchanges, the model call fails, or the output
 * is trivially short.
 */
async function writeSessionDailySummary(
  history: { query: string; answer: string }[],
  model: string,
): Promise<void> {
  const exchanges = history.filter((h) => h.query && h.answer);
  if (exchanges.length === 0) return;

  const transcript = exchanges
    .map((h, i) => `[${i + 1}] User: ${h.query.slice(0, 400)}\nAssistant: ${h.answer.slice(0, 600)}`)
    .join('\n\n');

  const prompt = `You are a financial research assistant. A user just finished a Dexter session.
Summarize the key facts, decisions, and insights from this session in concise markdown bullet points.

Rules:
- Only include durable, reusable facts (investment theses, risk flags, model assumptions, ticker notes)
- Date-stamp any financial figures (e.g. "AMD P/E ~45x as of 2026-03")
- Skip trivial exchanges (greetings, command help, failed lookups)
- Output 3–10 bullet points max. If nothing worth remembering occurred, output only: NOTHING_TO_STORE

Session transcript:
${transcript}`;

  try {
    // thinkOverride:false — session summaries need concise plain-text output, not thinking tokens
    // Use a 3-minute timeout — session summary is non-critical but can be slow on cloud models
    const result = await callLlm(prompt, { model, thinkOverride: false, timeoutMs: 180_000 });
    const text = typeof result.response === 'string' ? result.response.trim() : '';
    if (!text || text === 'NOTHING_TO_STORE' || text.length < 40) return;
    const today = new Date().toISOString().slice(0, 10);
    const manager = await MemoryManager.get();
    await manager.appendDailyMemory(`## Session summary — ${today}\n${text}`);
  } catch {
    // Non-fatal — never block exit on memory errors.
  }
}

function createScreen(
  title: string,
  description: string,
  body: any,
  footer?: string,
): Container {
  const container = new Container();
  if (title) {
    container.addChild(new Text(theme.bold(theme.primary(title)), 0, 0));
  }
  if (description) {
    container.addChild(new Text(theme.muted(description), 0, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(body);
  if (footer) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.muted(footer), 0, 0));
  }
  return container;
}

// ─── Slash command registry ───────────────────────────────────────────────────
// Keep this in sync with the handleSubmit switch below so /help always reflects
// the real set of available commands.

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help',      description: 'Show available commands and keyboard shortcuts' },
  { name: 'skills',    description: 'Browse available skills and how to invoke them' },
  { name: 'model',     description: 'Switch the LLM model or provider' },
  { name: 'sessions',  description: 'Browse and resume past conversations' },
  { name: 'think',     description: 'Toggle Ollama extended thinking on/off (thinking models only)' },
  { name: 'watchlist', description: 'Portfolio briefing — or: add TICKER [cost] [shares] | remove TICKER | list | show TICKER | snapshot' },
  { name: 'dream',     description: 'Consolidate memory files — or: show (status), force (bypass conditions)' },
  { name: 'memory',    description: 'Show consolidated memory files (MEMORY.md + FINANCE.md)' },
  { name: 'config',    description: 'Show or set agent configuration — or: set <key> <value>' },
];

function buildHelpPanel(): Container {
  const container = new Container();
  const COL = 10; // fixed width for the left (command/key) column

  const row = (label: string, desc: string) =>
    new Text(`  ${theme.primary(label.padEnd(COL))} ${theme.muted(desc)}`, 0, 0);

  container.addChild(new Text(theme.bold('Slash Commands'), 0, 0));
  container.addChild(new Spacer(1));
  for (const cmd of SLASH_COMMANDS) {
    container.addChild(row(`/${cmd.name}`, cmd.description ?? ''));
  }

  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.bold('Keyboard Shortcuts'), 0, 0));
  container.addChild(new Spacer(1));

  const shortcuts: [string, string][] = [
    ['↑ / ↓',   'Browse input history'],
    ['Tab',      'Accept autocomplete suggestion'],
    ['Esc',      'Cancel current operation'],
    ['Ctrl+C',   'Exit Dexter'],
  ];
  for (const [key, desc] of shortcuts) {
    container.addChild(row(key, desc));
  }

  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.bold('Tips'), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(row('/', 'Type / to see available commands'));
  container.addChild(row('Thinking', 'Enabled automatically for qwen3, deepseek-r1, qwq models'));
  container.addChild(row('Fallback', 'Dexter uses web search when financial APIs fail'));
  container.addChild(row('--deep', 'Launch with --deep flag for 40-iteration complex queries'));

  // Skills section — populated from discovered skills at render time
  const skills = discoverSkills();
  if (skills.length > 0) {
    const MAX_SKILL_DESC = 55;
    const skillCol = 22;
    const skillRow = (name: string, desc: string) => {
      const truncated = desc.length > MAX_SKILL_DESC ? `${desc.slice(0, MAX_SKILL_DESC - 1)}…` : desc;
      return new Text(`  ${theme.accent(name.padEnd(skillCol))} ${theme.muted(truncated)}`, 0, 0);
    };
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.bold('Available Skills') + theme.muted('  — invoke: "use the [name] skill for …"'), 0, 0));
    container.addChild(new Spacer(1));
    for (const skill of skills) {
      container.addChild(skillRow(skill.name, skill.description));
    }
  }

  return container;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function colorPct(n: number, text: string): string {
  return n >= 0 ? theme.success(text) : theme.error(text);
}

type WatchlistEntry = import('./controllers/watchlist-controller.js').WatchlistEntry;

function buildWatchlistPanel(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot> | null,
): Container {
  const container = new Container();
  if (entries.length === 0) {
    container.addChild(new Text(theme.muted('  No positions. Use /watchlist add TICKER [cost] [shares]'), 0, 0));
    return container;
  }

  if (prices === null) {
    // Loading state — show spinner line + stored data
    container.addChild(new Text(theme.muted('  ⏳ Fetching live prices…'), 0, 0));
    container.addChild(new Text('', 0, 0));
  }

  const enriched = prices ? buildEnrichedEntries(entries, prices) : null;
  const hasPrices = prices !== null && prices.size > 0;
  const hasPositions = entries.some((e) => e.costBasis !== undefined && e.shares !== undefined);

  // Header
  let header: string;
  if (hasPrices && hasPositions) {
    header = `  ${'TICKER'.padEnd(8)}  ${'CURRENT'.padStart(9)}  ${'DAY%'.padStart(7)}  ${'P&L'.padStart(10)}  ${'RETURN'.padStart(8)}  ${'ALLOC'.padStart(6)}`;
  } else if (hasPrices) {
    header = `  ${'TICKER'.padEnd(8)}  ${'CURRENT'.padStart(9)}  ${'DAY%'.padStart(7)}  ${'COST'.padStart(9)}  ${'SHARES'.padStart(8)}`;
  } else {
    header = `  ${'TICKER'.padEnd(8)}  ${'COST BASIS'.padStart(10)}  ${'SHARES'.padStart(8)}  ADDED`;
  }
  container.addChild(new Text(theme.bold(header), 0, 0));
  container.addChild(new Text(theme.muted('  ' + '─'.repeat(header.length - 2)), 0, 0));

  const rows = enriched ?? entries.map((e) => ({
    ticker: e.ticker, shares: e.shares, costBasis: e.costBasis, addedAt: e.addedAt,
    price: undefined, changePercent: undefined, pnl: undefined, returnPct: undefined,
    currentValue: undefined, allocPct: undefined,
  }));

  for (const row of rows) {
    const ticker = theme.primary(row.ticker.padEnd(8));

    if (hasPrices && hasPositions) {
      const price   = row.price !== undefined ? `$${row.price.toFixed(2)}`.padStart(9) : '         ';
      const day     = row.changePercent !== undefined
        ? colorPct(row.changePercent, fmtPct(row.changePercent).padStart(7))
        : '       ';
      const pnl     = row.pnl !== undefined
        ? colorPct(row.pnl, fmtMoney(row.pnl).padStart(10))
        : '          ';
      const ret     = row.returnPct !== undefined
        ? colorPct(row.returnPct, fmtPct(row.returnPct).padStart(8))
        : '        ';
      const alloc   = row.allocPct !== undefined
        ? `${row.allocPct.toFixed(0)}%`.padStart(6)
        : '      ';
      container.addChild(new Text(`  ${ticker}  ${price}  ${day}  ${pnl}  ${ret}  ${alloc}`, 0, 0));
    } else if (hasPrices) {
      const price   = row.price !== undefined ? `$${row.price.toFixed(2)}`.padStart(9) : '         ';
      const day     = row.changePercent !== undefined
        ? colorPct(row.changePercent, fmtPct(row.changePercent).padStart(7))
        : '       ';
      const cost    = row.costBasis !== undefined ? `$${row.costBasis}`.padStart(9) : '         ';
      const shares  = row.shares !== undefined ? String(row.shares).padStart(8) : '        ';
      container.addChild(new Text(`  ${ticker}  ${price}  ${day}  ${cost}  ${shares}`, 0, 0));
    } else {
      const cost    = row.costBasis !== undefined ? `$${row.costBasis}`.padStart(10) : '          ';
      const shares  = row.shares !== undefined ? String(row.shares).padStart(8) : '        ';
      const added   = theme.muted(row.addedAt);
      container.addChild(new Text(`  ${ticker}  ${cost}   ${shares}    ${added}`, 0, 0));
    }
  }

  // Portfolio totals row (only when we have full position data)
  if (hasPrices && hasPositions && prices) {
    const totals = calcPortfolioTotals(entries, prices);
    if (totals.totalInvested > 0) {
      container.addChild(new Text(theme.muted('  ' + '─'.repeat(header.length - 2)), 0, 0));
      const pnlColor = colorPct(totals.totalPnl, fmtMoney(totals.totalPnl).padStart(10));
      const retColor = colorPct(totals.totalReturnPct, fmtPct(totals.totalReturnPct).padStart(8));
      const totalLine = `  ${'TOTAL'.padEnd(8)}  ${fmtMoney(totals.totalCurrent).padStart(9)}  ${''.padStart(7)}  ${pnlColor}  ${retColor}`;
      container.addChild(new Text(theme.bold(totalLine), 0, 0));
    }
  }

  return container;
}

function buildShowPanel(ticker: string, snap: PriceSnapshot): Container {
  const container = new Container();
  const w = 62;
  const bar = '─'.repeat(w);

  // Title
  const name = snap.name ? `${ticker} — ${snap.name}` : ticker;
  container.addChild(new Text(theme.bold(`  ┌─ ${name}`), 0, 0));

  // Price row
  const dayStr = snap.changePercent !== undefined
    ? colorPct(snap.changePercent, ` (${fmtPct(snap.changePercent)})`)
    : '';
  const priceRow = `  │ Price: ${theme.primary(`$${snap.price.toFixed(2)}`)}${dayStr}`;
  const rangeStr = snap.high52Week !== undefined && snap.low52Week !== undefined
    ? `  52-wk: $${snap.low52Week.toFixed(2)} – $${snap.high52Week.toFixed(2)}`
    : '';
  container.addChild(new Text(priceRow + rangeStr, 0, 0));

  if (snap.marketCap !== undefined) {
    const mcStr = snap.marketCap >= 1e12
      ? `$${(snap.marketCap / 1e12).toFixed(2)}T`
      : snap.marketCap >= 1e9
        ? `$${(snap.marketCap / 1e9).toFixed(1)}B`
        : `$${(snap.marketCap / 1e6).toFixed(0)}M`;
    container.addChild(new Text(`  │ Mkt Cap: ${mcStr}`, 0, 0));
  }

  // Ratios
  const ratios: string[] = [];
  if (snap.pe !== undefined)       ratios.push(`P/E: ${snap.pe.toFixed(1)}`);
  if (snap.pb !== undefined)       ratios.push(`P/B: ${snap.pb.toFixed(1)}`);
  if (snap.evEbitda !== undefined) ratios.push(`EV/EBITDA: ${snap.evEbitda.toFixed(1)}`);
  if (snap.peg !== undefined)      ratios.push(`PEG: ${snap.peg.toFixed(1)}`);
  if (ratios.length > 0) {
    container.addChild(new Text(theme.muted('  ├' + bar), 0, 0));
    container.addChild(new Text(`  │ ${ratios.join('   ')}`, 0, 0));
  }

  // Analyst
  if (snap.analystRating !== undefined || snap.analystAvgTarget !== undefined) {
    container.addChild(new Text(theme.muted('  ├' + bar), 0, 0));
    const rating = snap.analystRating ? theme.primary(snap.analystRating.toUpperCase()) : '';
    const target = snap.analystAvgTarget !== undefined
      ? `  Avg Target: $${snap.analystAvgTarget.toFixed(2)}`
      : '';
    const upside = snap.analystAvgTarget !== undefined && snap.price > 0
      ? colorPct(
          (snap.analystAvgTarget / snap.price - 1) * 100,
          `  (${fmtPct((snap.analystAvgTarget / snap.price - 1) * 100)})`,
        )
      : '';
    container.addChild(new Text(`  │ Analyst: ${rating}${target}${upside}`, 0, 0));
  }

  // News
  if (snap.news && snap.news.length > 0) {
    container.addChild(new Text(theme.muted('  ├' + bar), 0, 0));
    for (const item of snap.news.slice(0, 3)) {
      const date = theme.muted(`(${item.date.slice(0, 10)})`);
      const title = item.title.length > 55 ? item.title.slice(0, 52) + '…' : item.title;
      container.addChild(new Text(`  │ ${date} ${title}`, 0, 0));
    }
  }

  container.addChild(new Text(theme.muted('  └' + bar), 0, 0));
  return container;
}

function buildSnapshotPanel(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot> | null,
): Container {
  const container = new Container();

  if (prices === null) {
    container.addChild(new Text(theme.muted('  ⏳ Fetching live prices…'), 0, 0));
    return container;
  }

  const today = new Date().toISOString().slice(0, 10);
  container.addChild(new Text(theme.bold(`  Portfolio Snapshot — ${today}`), 0, 0));
  container.addChild(new Text(theme.muted('  ' + '━'.repeat(40)), 0, 0));

  const { positionEntries, watchOnlyEntries, totals, hasNoData, best, worst } =
    buildSnapshotDisplayData(entries, prices);

  // Portfolio summary totals (only when positions exist with cost basis)
  if (totals.totalInvested > 0) {
    container.addChild(new Text(`  Total Invested:  ${fmtMoney(totals.totalInvested)}`, 0, 0));
    container.addChild(new Text(`  Current Value:   ${fmtMoney(totals.totalCurrent)}`, 0, 0));
    const pnlLine = `  Total P&L:       ${fmtMoney(totals.totalPnl)}  (${fmtPct(totals.totalReturnPct)})`;
    container.addChild(new Text(colorPct(totals.totalPnl, pnlLine), 0, 0));
    container.addChild(new Text('', 0, 0));
  }

  // ASCII bar chart for allocation
  if (positionEntries.length > 0) {
    container.addChild(new Text(theme.bold('  Allocation:'), 0, 0));
    const BAR_WIDTH = 26;
    for (const e of positionEntries) {
      const pct = e.allocPct!;
      const bar = buildAsciiBar(pct, BAR_WIDTH);
      const pctStr = `${pct.toFixed(0)}%`.padStart(4);
      container.addChild(new Text(`  ${e.ticker.padEnd(6)} ${theme.primary(bar)} ${pctStr}`, 0, 0));
    }
    container.addChild(new Text('', 0, 0));
  }

  // Performance ranking (best / worst)
  if (best && worst) {
    container.addChild(new Text(`  Best:  ${theme.primary(best.ticker.padEnd(6))} ${colorPct(best.returnPct!, fmtPct(best.returnPct!))}`, 0, 0));
    container.addChild(new Text(`  Worst: ${theme.primary(worst.ticker.padEnd(6))} ${colorPct(worst.returnPct!, fmtPct(worst.returnPct!))}`, 0, 0));
    container.addChild(new Text('', 0, 0));
  }

  // Watch-only section (tickers tracked without cost basis / shares)
  if (watchOnlyEntries.length > 0) {
    container.addChild(new Text(theme.muted('  Watching (no position):'), 0, 0));
    for (const e of watchOnlyEntries) {
      const day = e.changePercent !== undefined
        ? colorPct(e.changePercent, fmtPct(e.changePercent))
        : '';
      container.addChild(new Text(`  ${e.ticker.padEnd(8)} $${e.price!.toFixed(2)}  ${day}`, 0, 0));
    }
  }

  // "No data" fallback — only when nothing at all could be loaded
  if (hasNoData) {
    container.addChild(new Text(theme.muted('  No price data available. Add tickers with /watchlist add TICKER'), 0, 0));
    container.addChild(new Text(theme.muted('  To track P&L, provide cost basis: /watchlist add TICKER COST SHARES'), 0, 0));
  }

  return container;
}

/**
 * While a query is running, cap the number of visible events to keep the TUI
 * within the terminal viewport.  Without this limit, a long-running agent with
 * many tool calls would push the earliest events above the top of the screen
 * with no way for the user to scroll back (the TUI snaps to the bottom on
 * every re-render).  After completion, all events are shown.
 */
const MAX_RUNNING_EVENTS = 30;

/**
 * Render only the most recent history item (currently executing or just completed).
 * Completed exchanges are flushed to the terminal scrollback buffer so the TUI
 * stays lean — only the active query lives in the TUI viewport.
 */
function renderCurrentQuery(chatLog: ChatLogComponent, history: AgentRunnerController['history']) {
  chatLog.clearAll();
  const item = history[history.length - 1];
  if (!item) return;

  chatLog.addQuery(item.query);
  chatLog.resetToolGrouping();

  if (item.status === 'interrupted') {
    chatLog.addInterrupted();
  }

  // During an active run, cap visible events so the TUI stays within the viewport.
  // Once complete, render everything so the user sees the full picture.
  const isRunning = item.status !== 'complete' && item.status !== 'interrupted';
  const allEvents = item.events;
  const hiddenCount = isRunning && allEvents.length > MAX_RUNNING_EVENTS
    ? allEvents.length - MAX_RUNNING_EVENTS
    : 0;
  const visibleEvents = hiddenCount > 0 ? allEvents.slice(-MAX_RUNNING_EVENTS) : allEvents;

  if (hiddenCount > 0) {
    chatLog.addChild(new Text(theme.muted(`  … ${hiddenCount} earlier events`), 0, 0));
  }

  for (const display of visibleEvents) {
    const event = display.event;
    if (event.type === 'thinking') {
      const message = event.message.trim();
      if (message) {
        const preview = message.length > 120 ? `${message.slice(0, 120)}…` : message;
        chatLog.addChild(new Text(theme.muted(`  💭 ${preview}`), 0, 0));
      }
      continue;
    }

    if (event.type === 'reasoning') {
      const reasoning = (event as ReasoningEvent).content.trim();
      if (reasoning) {
        const preview = reasoning.length > 300 ? `${reasoning.slice(0, 300)}...` : reasoning;
        chatLog.addChild(new Spacer(1));
        chatLog.addChild(new Text(theme.muted(`💭 Reasoning (${reasoning.length} chars)`), 0, 0));
        chatLog.addChild(new Text(theme.muted(preview), 0, 0));
      }
      continue;
    }

    if (event.type === 'tool_start') {
      const toolStart = event as ToolStartEvent;
      const component = chatLog.startTool(display.id, toolStart.tool, toolStart.args);
      if (display.completed && display.endEvent?.type === 'tool_end') {
        const done = display.endEvent as ToolEndEvent;
        component.setComplete(
          summarizeToolResult(done.tool, toolStart.args, done.result),
          done.duration,
        );
      } else if (display.completed && display.endEvent?.type === 'tool_error') {
        const toolError = display.endEvent as ToolErrorEvent;
        component.setError(toolError.error);
      } else if (display.progressMessage) {
        component.setActive(display.progressMessage);
      }
      continue;
    }

    if (event.type === 'tool_approval') {
      const approval = chatLog.startTool(display.id, event.tool, event.args);
      approval.setApproval(event.approved);
      continue;
    }

    if (event.type === 'tool_denied') {
      const denied = chatLog.startTool(display.id, event.tool, event.args);
      const path = (event.args.path as string) ?? '';
      denied.setDenied(path, event.tool);
      continue;
    }

    if (event.type === 'tool_limit') {
      continue;
    }

    if (event.type === 'context_cleared') {
      chatLog.addContextCleared(event.clearedCount, event.keptCount);
    }
  }

  if (item.answer) {
    const termRows = process.stdout.rows ?? 40;
    // Reserve space for: header (1) + query (1) + events + stats (3) + editor (3) + margin (4)
    const reservedRows = Math.min(visibleEvents.length * 2 + 12, termRows - 10);
    const answerBudget = Math.max(10, termRows - reservedRows);
    const answerLines = item.answer.split('\n');
    const isStreaming = item.status === 'processing';

    if (answerLines.length > answerBudget) {
      if (isStreaming) {
        // During streaming: show only the tail so the TUI never overflows the viewport.
        // Overflow would push early lines into the terminal's native scrollback,
        // making it impossible for flushExchangeToScrollback() to clear them — causing
        // the answer to appear twice (partial live view + full flushed version).
        const tail = answerLines.slice(-answerBudget).join('\n');
        chatLog.finalizeAnswer(`…\n${tail}`);
      } else {
        // Complete long answer: show a one-line stub.
        // The auto-flush logic (after runQuery returns) will write the full answer
        // to scrollback and replace this with a "scroll to read" hint.
        // Keeping the TUI content tiny here ensures flushExchangeToScrollback()'s
        // cursor arithmetic stays within the viewport.
        chatLog.finalizeAnswer(`…  (${answerLines.length} lines — writing to scrollback)`);
      }
    } else {
      chatLog.finalizeAnswer(item.answer);
    }
  }
  if (item.status === 'complete') {
    chatLog.addPerformanceStats(item.duration ?? 0, item.tokenUsage, item.tokensPerSecond);
  }
}


/**
 * Flush a completed exchange to the terminal's native scrollback buffer.
 *
 * How it works:
 *  1. Capture how many lines the TUI is currently rendering (before stop).
 *  2. Stop the TUI — this positions the hardware cursor at the end of all
 *     rendered content and briefly disables raw mode.
 *  3. Move the cursor back to the top of the TUI area and clear downward so
 *     the "live processing" view doesn't litter the scrollback.
 *  4. Write the formatted exchange — it lands in the terminal's scroll buffer.
 *  5. Clear the TUI component tree (chatLog) so the next render starts fresh.
 *  6. Restart the TUI — re-enables raw mode, resets rendering state, re-renders
 *     the now-empty chatLog + editor from the current cursor position.
 */
export function flushExchangeToScrollback(
  tui: TUI,
  chatLog: ChatLogComponent,
  item: HistoryItem,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tuiInternal = tui as any;
  // Snapshot BEFORE stop() moves the cursor.
  const prevLineCount: number = tuiInternal.previousLines?.length ?? 0;

  // Stop TUI: moves cursor to end of rendered content (+\r\n), disables raw mode.
  tui.stop();

  // Move cursor back to the top of the TUI's rendered area and clear to end of
  // screen so the live processing trail doesn't appear above the clean output.
  if (prevLineCount > 0) {
    // After stop(), cursor is near the bottom of the terminal viewport.
    // IMPORTANT: clamp to terminal height — if prevLineCount > terminal rows the TUI
    // was using internal viewport scrolling, and moving up more than the viewport
    // height would overshoot into the scrollback buffer, causing \x1b[J to wipe
    // previously-committed exchange content.
    const termRows = process.stdout.rows ?? 24;
    const moveUp = Math.min(prevLineCount + 1, termRows);
    process.stdout.write(`\x1b[${moveUp}A`); // move up (clamped to viewport)
    process.stdout.write('\x1b[J');          // clear to end of screen
  }

  // Write the formatted exchange — this is what lands in the scroll buffer.
  process.stdout.write(formatExchangeForScrollback(item));

  // Clear TUI component state.
  chatLog.clearAll();

  // Restart TUI: re-enable raw mode, hide cursor.
  //
  // IMPORTANT: Do NOT call tui.requestRender(true) here.
  // requestRender(true) sets previousWidth = -1 which causes the next render to
  // take the "width changed" code path → fullRender(clear=true) → \x1b[3J which
  // CLEARS THE ENTIRE SCROLLBACK BUFFER, erasing the exchange we just wrote above.
  //
  // Instead, manually reset only the cursor-tracking fields and leave previousWidth
  // at its current value. With previousLines=[] and widthChanged=false, the render
  // takes the "first render" path → fullRender(clear=false) → writes UI content at
  // the current cursor position WITHOUT touching the scrollback buffer.
  tuiInternal.previousLines = [];
  tuiInternal.cursorRow = 0;
  tuiInternal.hardwareCursorRow = 0;
  tuiInternal.maxLinesRendered = 0;
  tuiInternal.previousViewportTop = 0;
  // Do NOT reset previousWidth — keeps widthChanged=false → no \x1b[3J scrollback wipe.
  tui.start();
  tui.requestRender(); // non-force: uses manual state above, hits "first render" path
}

export async function runCli() {
  // --deep flag: raises max agent iterations to 40 for complex multi-skill queries
  const isDeepMode = process.argv.includes('--deep');
  const maxIterations = isDeepMode ? 40 : DEFAULT_MAX_ITERATIONS;

  const tui = new TUI(new ProcessTerminal());
  const root = new Container();
  const chatLog = new ChatLogComponent(tui);
  const inputHistory = new InputHistoryController(() => tui.requestRender());
  let lastError: string | null = null;
  let helpVisible = false;
  let sessionsVisible = false;
  let watchlistVisible = false;
  let watchlistMode: 'list' | 'show' | 'snapshot' = 'list';
  let watchlistShowTicker: string | null = null;
  let watchlistEntries: WatchlistEntry[] = [];
  // null = loading, Map = loaded (may be empty if API unavailable)
  let watchlistPrices: Map<string, PriceSnapshot> | null = null;
  let sessionsList: SessionIndexEntry[] = [];
  let resumedSessionName: string | null = null;
  // null = auto-detect from model name; true/false = explicit override
  let thinkEnabled: boolean | null = null;
  let sessionStarted = false;
  let dreamRunning = false;
  // Memory overlay state
  let memoryVisible = false;
  // null = loading; string = content (may be empty)
  let memoryContent: { memory: string; finance: string } | null = null;
  // Skills overlay state
  let skillsVisible = false;
  let skillsList: SkillMetadata[] = [];
  // Tracks exchanges already flushed to scrollback on completion (long answers).
  // Prevents the "flush on next submit" path from double-writing them.
  const flushedItems = new WeakSet<HistoryItem>();

  const sessionController = new SessionController();

  const onError = (message: string) => {
    lastError = message;
    logger.error(message);
    tui.requestRender();
  };

  const modelSelection = new ModelSelectionController(onError, () => {
    // Reset thinking override when the user switches models — the new model may
    // or may not support thinking, so auto-detect is the correct default.
    thinkEnabled = null;
    agentRunner.setThinkEnabled(undefined);
    intro.setModel(modelSelection.model);
    renderSelectionOverlay();
    tui.requestRender();
  });

  const agentRunner = new AgentRunnerController(
    { model: modelSelection.model, modelProvider: modelSelection.provider, maxIterations },
    modelSelection.inMemoryChatHistory,
    () => {
      renderCurrentQuery(chatLog, agentRunner.history);
      workingIndicator.setState(agentRunner.workingState);
      renderSelectionOverlay();
      tui.requestRender();
    },
  );

  const intro = new IntroComponent(modelSelection.model);
  const errorText = new Text('', 0, 0);
  const workingIndicator = new WorkingIndicatorComponent(tui);
  const editor = new CustomEditor(tui, editorTheme);
  const debugPanel = new DebugPanelComponent(8, process.env.DEBUG === 'true' || process.env.DEBUG === '1');

  // Detect fd/fdfind for fuzzy @ completion; falls back to readdirSync if absent.
  const fdPath = Bun.which('fd') ?? Bun.which('fdfind') ?? null;
  editor.setAutocompleteProvider(new AtPathAutocompleteProvider(SLASH_COMMANDS, process.cwd(), fdPath));

  tui.addChild(root);

  const refreshError = () => {
    const message = lastError ?? agentRunner.error;
    errorText.setText(message ? theme.error(`Error: ${message}`) : '');
  };

  // ---------------------------------------------------------------------------
  // Watchlist price fetchers (dependency-injected pattern for testability)
  // ---------------------------------------------------------------------------

  const makePriceFetcher = (): PriceFetcher => async (ticker: string) => {
    try {
      const { data } = await api.get('/prices/snapshot/', { ticker });
      const snap = data.snapshot as Record<string, unknown> | undefined;
      if (!snap) return null;
      const price = Number(snap.price ?? snap.close ?? 0);
      if (!price) return null;
      return {
        ticker,
        price,
        changePercent: Number(snap.change_percent ?? snap.percent_change ?? 0),
        high52Week:    snap.week_52_high !== undefined ? Number(snap.week_52_high) : undefined,
        low52Week:     snap.week_52_low  !== undefined ? Number(snap.week_52_low)  : undefined,
        marketCap:     snap.market_cap   !== undefined ? Number(snap.market_cap)   : undefined,
        name:          typeof snap.name === 'string' ? snap.name : undefined,
      } satisfies PriceSnapshot;
    } catch {
      return null;
    }
  };

  const fetchShowData = async (ticker: string): Promise<PriceSnapshot | null> => {
    const fetcher = makePriceFetcher();
    const base = await fetcher(ticker);
    if (!base) return null;

    // Fetch ratios + analyst targets + news in parallel
    const [ratiosResult, analystResult, newsResult] = await Promise.allSettled([
      api.get('/financial-metrics/snapshot/', { ticker }),
      // Yahoo Finance analyst targets via env-conditional endpoint
      (async () => {
        const yahooFd = await import('./tools/finance/yahoo-finance.js');
        const result = await yahooFd.getYahooAnalystTargets.invoke({ ticker });
        return typeof result === 'string' ? JSON.parse(result) : result;
      })(),
      api.get('/news', { ticker, limit: 3 }),
    ]);

    const snap: PriceSnapshot = { ...base };

    if (ratiosResult.status === 'fulfilled') {
      const r = (ratiosResult.value.data.snapshot ?? {}) as Record<string, unknown>;
      if (r.price_to_earnings !== undefined) snap.pe = Number(r.price_to_earnings);
      if (r.price_to_book     !== undefined) snap.pb = Number(r.price_to_book);
      if (r.ev_to_ebitda      !== undefined) snap.evEbitda = Number(r.ev_to_ebitda);
      if (r.peg_ratio         !== undefined) snap.peg = Number(r.peg_ratio);
    }

    if (analystResult.status === 'fulfilled') {
      const a = analystResult.value as Record<string, unknown>;
      if (a.recommendationKey) snap.analystRating  = String(a.recommendationKey);
      if (a.targetMeanPrice)   snap.analystAvgTarget = Number(a.targetMeanPrice);
    }

    if (newsResult.status === 'fulfilled') {
      const items = (newsResult.value.data.news as unknown[]) ?? [];
      snap.news = items.slice(0, 3).map((n) => {
        const item = n as Record<string, unknown>;
        return {
          title:  String(item.title ?? ''),
          date:   String(item.date ?? item.published_at ?? ''),
          source: typeof item.source === 'string' ? item.source : undefined,
        };
      });
    }

    return snap;
  };

  const handleSubmit = async (query: string) => {
    // Dismiss help overlay before processing; re-show below only if /help typed again.
    if (helpVisible) {
      helpVisible = false;
      renderSelectionOverlay();
    }
    if (watchlistVisible) {
      watchlistVisible = false;
      renderSelectionOverlay();
    }
    if (sessionsVisible) {
      sessionsVisible = false;
      renderSelectionOverlay();
    }
    if (memoryVisible) {
      memoryVisible = false;
      renderSelectionOverlay();
    }
    if (skillsVisible) {
      skillsVisible = false;
      renderSelectionOverlay();
    }

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      tui.stop();
      await writeSessionDailySummary(agentRunner.history, modelSelection.model);
      await sessionController.flush();
      process.exit(0);
      return;
    }

    if (query === '/help') {
      helpVisible = true;
      renderSelectionOverlay();
      return;
    }

    if (query === '/think') {
      const model = modelSelection.model;
      if (!isThinkingModel(model)) {
        lastError = `${model} does not support extended thinking (supported: qwen3, deepseek-r1, qwq)`;
        refreshError();
        tui.requestRender();
      } else {
        // Cycle: auto(on) → off → auto(on)
        // null  = auto (effective: on for thinking models)
        // false = forced off
        const wasOff = thinkEnabled === false;
        thinkEnabled = wasOff ? null : false;
        agentRunner.setThinkEnabled(thinkEnabled ?? undefined);
        const label = thinkEnabled === false ? '🔕 Thinking OFF' : '🧠 Thinking ON (auto)';
        lastError = null;
        // Show brief status via the intro line (reuses existing text component path)
        intro.setModel(`${model}  ${label}`);
        renderSelectionOverlay();
        tui.requestRender();
        // Restore normal model label after 3 s
        setTimeout(() => {
          intro.setModel(model);
          tui.requestRender();
        }, 3000);
      }
      return;
    }

    if (query === '/model') {
      modelSelection.startSelection();
      return;
    }

    if (query === '/sessions') {
      sessionsList = await sessionController.listSessions();
      sessionsVisible = true;
      renderSelectionOverlay();
      tui.requestRender();
      return;
    }

    if (query === '/skills') {
      skillsList = discoverSkills();
      skillsVisible = true;
      renderSelectionOverlay();
      tui.requestRender();
      return;
    }

    if (query.startsWith('/export')) {
      const parts = query.split(/\s+/);
      const format = (parts[1] ?? 'markdown') as 'markdown' | 'json' | 'csv';
      const validFormats = ['markdown', 'json', 'csv'];
      if (!validFormats.includes(format)) {
        lastError = `Invalid export format "${format}". Use: markdown, json, csv`;
        refreshError();
        tui.requestRender();
        return;
      }
      const exportHistory = agentRunner.history.filter((h) => h.status === 'complete');
      if (exportHistory.length === 0) {
        lastError = 'No completed queries to export.';
        refreshError();
        tui.requestRender();
        return;
      }
      try {
        const { path } = exportSession(exportHistory, format, undefined);
        lastError = null;
        intro.setModel(`✓ Exported to ${path}`);
        tui.requestRender();
        setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 3000);
      } catch (e) {
        lastError = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
        refreshError();
        tui.requestRender();
      }
      return;
    }

    if (query.startsWith('/watchlist')) {
      const watchlistCtrl = new WatchlistController(process.cwd());
      const sub = parseWatchlistSubcommand(query.slice('/watchlist'.length).trim());

      // Flush current completed exchange to scrollback before any overlay hides chatLog.
      // This preserves the conversation history so it isn't visually erased when the
      // watchlist panel renders over the chat area.
      if (sub.cmd === 'list' || sub.cmd === 'show' || sub.cmd === 'snapshot') {
        const prevItem = agentRunner.history.at(-1);
        if (prevItem && (prevItem.status === 'complete' || prevItem.status === 'interrupted')) {
          flushExchangeToScrollback(tui, chatLog, prevItem);
        }
      }

      if (sub.cmd === 'add') {
        watchlistCtrl.add(sub.ticker, sub.costBasis, sub.shares);
        const detail = [
          sub.costBasis !== undefined ? `@ $${sub.costBasis}` : '',
          sub.shares !== undefined ? `× ${sub.shares} shares` : '',
        ].filter(Boolean).join(' ');
        lastError = null;
        intro.setModel(`✓ Added ${sub.ticker}${detail ? ' ' + detail : ''} to watchlist`);
        tui.requestRender();
        setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 3000);
        // Seed the new ticker into financial memory so recall_financial_context
        // returns a hit even before any LLM analysis runs.
        void seedWatchlistEntries([{ ticker: sub.ticker, costBasis: sub.costBasis, shares: sub.shares }]);
        return;
      }

      if (sub.cmd === 'remove') {
        watchlistCtrl.remove(sub.ticker);
        lastError = null;
        intro.setModel(`✓ Removed ${sub.ticker} from watchlist`);
        tui.requestRender();
        setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 3000);
        return;
      }

      if (sub.cmd === 'list') {
        watchlistEntries = watchlistCtrl.list();
        watchlistMode = 'list';
        watchlistShowTicker = null;
        watchlistPrices = null; // will show loading state
        watchlistVisible = true;
        renderSelectionOverlay();
        tui.requestRender();
        // Fetch prices in background; re-render when done
        void fetchLivePrices(watchlistEntries.map((e) => e.ticker), makePriceFetcher()).then((prices) => {
          watchlistPrices = prices;
          if (watchlistVisible) { renderSelectionOverlay(); tui.requestRender(); }
        });
        return;
      }

      if (sub.cmd === 'show') {
        const ticker = sub.ticker;
        const allEntries = watchlistCtrl.list();
        watchlistEntries = allEntries;
        watchlistMode = 'show';
        watchlistShowTicker = ticker;
        watchlistPrices = null;
        watchlistVisible = true;
        renderSelectionOverlay();
        tui.requestRender();
        // Fetch rich data for this ticker
        void fetchShowData(ticker).then((snap) => {
          watchlistPrices = snap ? new Map([[ticker, snap]]) : new Map();
          if (watchlistVisible) { renderSelectionOverlay(); tui.requestRender(); }
        });
        return;
      }

      if (sub.cmd === 'snapshot') {
        watchlistEntries = watchlistCtrl.list();
        watchlistMode = 'snapshot';
        watchlistShowTicker = null;
        watchlistPrices = null;
        watchlistVisible = true;
        renderSelectionOverlay();
        tui.requestRender();
        void fetchLivePrices(watchlistEntries.map((e) => e.ticker), makePriceFetcher()).then((prices) => {
          watchlistPrices = prices;
          if (watchlistVisible) { renderSelectionOverlay(); tui.requestRender(); }
        });
        return;
      }

      // Bare /watchlist — run briefing skill with injected context.
      if (watchlistCtrl.isEmpty()) {
        lastError = 'Watchlist is empty. Use /watchlist add TICKER [cost] [shares] to add positions.';
        refreshError();
        renderSelectionOverlay();
        tui.requestRender();
        return;
      }

      const entries = watchlistCtrl.list();
      const context = entries
        .map((e) => {
          const parts = [e.ticker];
          if (e.shares !== undefined && e.costBasis !== undefined)
            parts.push(`(${e.shares} shares @ $${e.costBasis})`);
          else if (e.costBasis !== undefined)
            parts.push(`(@ $${e.costBasis})`);
          return parts.join(' ');
        })
        .join(', ');
      // Fall through to agent submission with injected watchlist context.
      query = `Run watchlist briefing for: ${context}`;
    }

    if (query.startsWith('/dream')) {
      // --- /dream show — show dream status without running ---
      if (query.trim() === '/dream show' || query.trim() === '/dream status') {
        const dreamStore = new MemoryStore();
        const [meta, dailyFiles] = await Promise.all([
          dreamStore.readDreamMeta(),
          dreamStore.listDailyFiles(),
        ]);
        const lastRun = meta?.lastRunAt
          ? new Date(meta.lastRunAt).toLocaleString()
          : 'Never';
        const elapsedH = meta?.lastRunAt
          ? Math.floor((Date.now() - meta.lastRunAt) / 3_600_000)
          : null;
        const elapsedLabel = elapsedH !== null
          ? elapsedH >= 24 ? `${Math.floor(elapsedH / 24)}d ${elapsedH % 24}h ago` : `${elapsedH}h ago`
          : '—';
        const ready = shouldRunDream(meta, dailyFiles);
        const statusIcon = ready ? '✅' : '⏳';
        const statusLabel = ready ? 'Ready to consolidate' : 'Conditions not yet met';
        const needFiles = Math.max(0, 2 - dailyFiles.length);
        const needSessions = meta ? Math.max(0, 3 - (meta.sessionsSinceLastRun ?? 0)) : 3;
        const needHours = meta?.lastRunAt
          ? Math.max(0, 24 - Math.floor((Date.now() - meta.lastRunAt) / 3_600_000))
          : 0;
        const conditions: string[] = [];
        if (needFiles > 0) conditions.push(`${dailyFiles.length}/2 daily files`);
        if (needSessions > 0) conditions.push(`${meta?.sessionsSinceLastRun ?? 0}/3 sessions`);
        if (needHours > 0) conditions.push(`${needHours}h until 24h interval`);
        const condText = conditions.length > 0
          ? `\n\n_Waiting on: ${conditions.join(' · ')}_`
          : '';
        const fileList = dailyFiles.length > 0
          ? dailyFiles.map((f) => `  • ${f}`).join('\n')
          : '  _(none yet — exit Dexter after conversations to generate them)_';
        const showAnswer = [
          `🌙 **Dream Status**`,
          ``,
          `${statusIcon} **${statusLabel}**${condText}`,
          ``,
          `| Field | Value |`,
          `|---|---|`,
          `| Last run | ${lastRun} ${elapsedLabel !== '—' ? `(${elapsedLabel})` : ''} |`,
          `| Total runs | ${meta?.totalRuns ?? 0} |`,
          `| Sessions since last run | ${meta?.sessionsSinceLastRun ?? 0} / 3 required |`,
          `| Daily files available | ${dailyFiles.length} / 2 required |`,
          ``,
          `**Daily files:**`,
          fileList,
          ``,
          `_Run \`/dream force\` to consolidate regardless of conditions._`,
        ].join('\n');
        flushExchangeToScrollback(tui, chatLog, {
          id: `dream-show-${Date.now()}`,
          query,
          events: [],
          answer: showAnswer,
          status: 'complete',
          duration: 0,
        });
        return;
      }

      if (agentRunner.isProcessing || dreamRunning) {
        lastError = dreamRunning
          ? 'Dream is already running.'
          : 'Cannot run Dream while the agent is busy.';
        refreshError();
        tui.requestRender();
        return;
      }
      const force = query.slice('/dream'.length).trim() === 'force';
      const dreamStore = new MemoryStore();
      dreamRunning = true;
      intro.setModel('🌙 Dream: consolidating memories…');
      tui.requestRender();
      const dreamStart = Date.now();
      // Keep TUI alive during the long LLM consolidation call (can take 2-5 min).
      const dreamHeartbeat = setInterval(() => tui.requestRender(), 1500);
      let dreamAnswer = '';
      try {
        const dreamResult = await runDream(dreamStore, modelSelection.model, { force });
        if (dreamResult.ran) {
          const n = dreamResult.archivedFiles.length;
          const files = dreamResult.archivedFiles.map((f) => `  • ${f}`).join('\n');
          const archiveLine = n > 0
            ? `**Archived ${n} daily file${n === 1 ? '' : 's'}:**\n${files}\n\n`
            : `_No daily session files to archive — exit Dexter (ctrl+c) after conversations to generate them._\n\n`;
          dreamAnswer = `✨ **Dream complete** — memory consolidated\n\n${archiveLine}**Updated:** MEMORY.md, FINANCE.md`;
          intro.setModel(`✨ Dream: archived ${n} file${n === 1 ? '' : 's'}, memory updated`);
        } else {
          dreamAnswer = `🌙 **Dream skipped**\n\n${dreamResult.reason}\n\nUse \`/dream force\` to run regardless of conditions.`;
          intro.setModel(`🌙 Dream: ${dreamResult.reason}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dreamAnswer = `❌ **Dream error**\n\n${msg}`;
        intro.setModel(`Dream error: ${msg}`);
      } finally {
        dreamRunning = false;
        clearInterval(dreamHeartbeat);
      }
      // Flush previous agent exchange to scrollback (only if not already flushed by
      // the long-answer auto-flush path — same guard as the regular query path).
      const prevItem = agentRunner.history.at(-1);
      if (prevItem && (prevItem.status === 'complete' || prevItem.status === 'interrupted') && !flushedItems.has(prevItem)) {
        flushExchangeToScrollback(tui, chatLog, prevItem);
        flushedItems.add(prevItem);
        // Small yield: let TUI settle before the second flush.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      flushExchangeToScrollback(tui, chatLog, {
        id: `dream-${dreamStart}`,
        query,
        events: [],
        answer: dreamAnswer,
        status: 'complete',
        duration: Date.now() - dreamStart,
      });
      setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 5000);
      return;
    }

    if (query === '/memory' || query === '/memory show') {
      memoryVisible = true;
      memoryContent = null; // loading
      renderSelectionOverlay();
      tui.requestRender();
      // Load both files asynchronously then re-render.
      const memStore = new MemoryStore();
      Promise.all([
        memStore.readMemoryFile('MEMORY.md').catch(() => ''),
        memStore.readMemoryFile('FINANCE.md').catch(() => ''),
      ]).then(([memory, finance]) => {
        memoryContent = { memory: memory.trim(), finance: finance.trim() };
        if (memoryVisible) { renderSelectionOverlay(); tui.requestRender(); }
      });
      return;
    }

    if (query === '/config' || query === '/config show') {
      const configKeys: Array<{ key: string; default: number }> = [
        { key: 'maxIterations',    default: 25 },
        { key: 'contextThreshold', default: 100000 },
        { key: 'keepToolUses',     default: 5 },
        { key: 'cacheTtlMs',       default: 900000 },
        { key: 'parallelToolLimit',default: 0 },
      ];
      const lines: string[] = ['Current Configuration:'];
      for (const { key, default: def } of configKeys) {
        const raw = getSetting<number | undefined>(key, undefined);
        const isDefault = raw === undefined;
        const display = raw ?? def;
        const extra = isDefault ? ' (default)' : '';
        const suffix = key === 'parallelToolLimit' && display === 0 ? ' (unlimited)' : '';
        lines.push(`  ${key.padEnd(18)} ${display}${suffix}${extra}`);
      }
      const provider = getSetting<string | undefined>('provider', undefined);
      const modelId  = getSetting<string | undefined>('modelId', undefined);
      if (provider) lines.push(`  ${'provider'.padEnd(18)} ${provider}`);
      if (modelId)  lines.push(`  ${'modelId'.padEnd(18)} ${modelId}`);

      chatLog.clearAll();
      chatLog.addQuery(query);
      chatLog.resetToolGrouping();
      chatLog.finalizeAnswer(lines.join('\n'));
      tui.requestRender();
      return;
    }

    if (query.startsWith('/config set ')) {
      const parts = query.slice('/config set '.length).trim().split(/\s+/);
      if (parts.length < 2) {
        lastError = 'Usage: /config set <key> <value>';
        refreshError();
        tui.requestRender();
        return;
      }
      const [cfgKey, rawVal] = parts;
      const numVal = Number(rawVal);
      const value: unknown = Number.isFinite(numVal) ? numVal : rawVal;
      const validation = validateConfigValue(cfgKey, value);
      if (!validation.valid) {
        lastError = `Config error: ${validation.error}`;
        refreshError();
        tui.requestRender();
        return;
      }
      setSetting(cfgKey, value);
      lastError = null;
      intro.setModel(`✓ Config: ${cfgKey} = ${String(value)}`);
      tui.requestRender();
      setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 3000);
      return;
    }

    if (modelSelection.isInSelectionFlow() || sessionsVisible || skillsVisible || watchlistVisible || agentRunner.pendingApproval || agentRunner.isProcessing) {
      return;
    }

    // Flush the PREVIOUS completed exchange to scrollback before starting the
    // new query.  If it was already flushed on completion (long answer path),
    // skip the scrollback write and just clear the compact TUI view.
    const prevItem = agentRunner.history.at(-1);
    if (prevItem && (prevItem.status === 'complete' || prevItem.status === 'interrupted')) {
      if (flushedItems.has(prevItem)) {
        chatLog.clearAll(); // compact view is still in chatLog; clear it
      } else {
        flushExchangeToScrollback(tui, chatLog, prevItem);
        flushedItems.add(prevItem);
      }
    }

    await inputHistory.saveMessage(query);
    inputHistory.resetNavigation();

    // Auto-save: start a new session on the first query of each run.
    if (!sessionStarted) {
      sessionStarted = true;
      void sessionController.startSession(query);
    }

    const result = await agentRunner.runQuery(query);
    if (result?.answer) {
      await inputHistory.updateAgentResponse(result.answer);
    }

    // Persist the updated history after each completed exchange.
    sessionController.autosave(agentRunner.history, modelSelection.inMemoryChatHistory);

    // Update running token counter in the compact status bar.
    const totalTokens = agentRunner.history.reduce(
      (sum, item) => sum + (item.tokenUsage?.totalTokens ?? 0),
      0,
    );
    intro.setTokenCount(totalTokens);

    // If the answer is longer than the terminal can display, flush it to terminal
    // scrollback immediately so the user can scroll up to read it.  Show a compact
    // "done" line in the TUI viewport instead.  Short answers stay in the TUI
    // until the next query (current behaviour) so the user can read them inline.
    const completedItem = agentRunner.history.at(-1);
    const termRows = process.stdout.rows ?? 40;
    const longAnswerThreshold = Math.max(20, termRows - 8);
    if (
      completedItem &&
      completedItem.status === 'complete' &&
      !flushedItems.has(completedItem) &&
      (completedItem.answer ?? '').split('\n').length > longAnswerThreshold
    ) {
      flushExchangeToScrollback(tui, chatLog, completedItem);
      flushedItems.add(completedItem);
      const dur = formatDuration(completedItem.duration ?? 0);
      const toks = (completedItem.tokenUsage?.totalTokens ?? 0).toLocaleString();
      chatLog.addChild(new Text(
        theme.muted(`  ↑ scroll terminal to read full response  ·  ${dur}  ·  ${toks} tokens`),
        0, 0,
      ));
    }

    refreshError();
    tui.requestRender();
  };

  editor.onSubmit = (text) => {
    const value = text.trim();
    // Empty Enter while a modal overlay is open → close it (same as Esc).
    if (!value) {
      if (memoryVisible) {
        memoryVisible = false;
        renderSelectionOverlay();
        tui.requestRender();
      } else if (watchlistVisible) {
        watchlistVisible = false;
        renderSelectionOverlay();
        tui.requestRender();
      } else if (helpVisible) {
        helpVisible = false;
        renderSelectionOverlay();
        tui.requestRender();
      } else if (skillsVisible) {
        skillsVisible = false;
        renderSelectionOverlay();
        tui.requestRender();
      }
      return;
    }
    editor.setText('');
    editor.addToHistory(value);
    void handleSubmit(value);
  };

  editor.onEscape = () => {
    if (memoryVisible) {
      memoryVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (skillsVisible) {
      skillsVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (helpVisible) {
      helpVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (watchlistVisible) {
      watchlistVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (sessionsVisible) {
      sessionsVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (modelSelection.isInSelectionFlow()) {
      modelSelection.cancelSelection();
      return;
    }
    if (agentRunner.isProcessing || agentRunner.pendingApproval) {
      agentRunner.cancelExecution();
      return;
    }
  };

  editor.onCtrlC = () => {
    if (modelSelection.isInSelectionFlow()) {
      modelSelection.cancelSelection();
      return;
    }
    if (agentRunner.isProcessing || agentRunner.pendingApproval) {
      agentRunner.cancelExecution();
      return;
    }
    tui.stop();
    // Write an end-of-session daily summary so Dream has material to consolidate,
    // then flush the session autosave, then exit.
    void writeSessionDailySummary(agentRunner.history, modelSelection.model)
      .finally(() => sessionController.flush().finally(() => process.exit(0)));
  };

  const renderMainView = () => {
    root.clear();
    // Collapse the 15-line ASCII intro to a single header line once the user
    // has started a conversation, freeing vertical space for the chat log.
    intro.setCompact(agentRunner.history.length > 0);
    // Sync think state into the status bar (auto = on for thinking-capable models).
    intro.setThinkState(thinkEnabled !== false && isThinkingModel(modelSelection.model));
    root.addChild(intro);
    root.addChild(chatLog);
    if (lastError ?? agentRunner.error) {
      root.addChild(errorText);
    }
    if (agentRunner.workingState.status !== 'idle') {
      root.addChild(workingIndicator);
    }
    // Hint footer: keyboard shortcuts when idle, cancel hint while running.
    const hintLine = agentRunner.isProcessing
      ? theme.muted('  esc · cancel query')
      : theme.muted('  ↑↓ history  ·  /help  /skills  /model  /watchlist  /memory  /dream  ·  ctrl+c exit');
    root.addChild(new Text(hintLine, 0, 0));
    root.addChild(editor);
    root.addChild(debugPanel);
    tui.setFocus(editor);
  };

  const renderScreenView = (
    title: string,
    description: string,
    body: any,
    footer?: string,
    focusTarget?: any,
  ) => {
    root.clear();
    root.addChild(createScreen(title, description, body, footer));
    if (focusTarget) {
      tui.setFocus(focusTarget);
    }
  };

  /**
   * Renders a watchlist panel (list / show / snapshot) with the editor visible
   * at the bottom.  Including the editor in the component tree means:
   *   - The cursor is visible so the user knows the TUI is interactive.
   *   - Keyboard input shows in the editor (the user can type the next command).
   *   - Esc (and Enter on an empty line) both close the panel as expected.
   *   - The hint line tells the user which commands make sense next.
   */
  const renderWatchlistView = (
    title: string,
    description: string,
    panel: Container,
    hint: string,
  ) => {
    root.clear();
    root.addChild(createScreen(title, description, panel));
    root.addChild(new Text(theme.muted(hint), 0, 0));
    root.addChild(editor);
    root.addChild(debugPanel);
    tui.setFocus(editor);
  };

  const renderSelectionOverlay = () => {
    const state = modelSelection.state;

    if (helpVisible) {
      renderScreenView(
        '⬡ Dexter — Help',
        '',
        buildHelpPanel(),
        'Esc to close · type a question to close and ask',
        editor,
      );
      return;
    }

    if (sessionsVisible) {
      const selector = createSessionSelector(sessionsList, async (id) => {
        sessionsVisible = false;
        if (id) {
          const loaded = await sessionController.loadSession(id);
          if (loaded) {
            // Flush any current exchange to scrollback before overwriting history.
            const prevItem = agentRunner.history.at(-1);
            if (prevItem && (prevItem.status === 'complete' || prevItem.status === 'interrupted')) {
              flushExchangeToScrollback(tui, chatLog, prevItem);
            } else {
              chatLog.clearAll();
            }

            // Restore LLM context — seed InMemoryChatHistory from the compact layer.
            modelSelection.inMemoryChatHistory.seedFromLlmMessages(
              loaded.llmMessages,
              loaded.priorSummary,
            );

            // Restore display history.
            agentRunner.loadHistory(loaded.history);

            resumedSessionName = loaded.name;
            sessionStarted = true;
            // Adopt the loaded session as current so auto-saves append to it.
            void sessionController.startSessionFromLoaded(loaded);

            intro.setModel(`${modelSelection.model}  ↩ ${loaded.name}`);
            setTimeout(() => {
              intro.setModel(modelSelection.model);
              tui.requestRender();
            }, 4000);
          }
        }
        renderSelectionOverlay();
        tui.requestRender();
      });
      renderScreenView(
        '⬡ Dexter — Sessions',
        'Select a past conversation to resume',
        selector,
        'Enter to resume · ↑↓ navigate · Esc to close',
        selector,
      );
      return;
    }

    if (skillsVisible) {
      const selector = createSkillSelector(skillsList, (name) => {
        skillsVisible = false;
        if (name) {
          editor.setText(`Use the ${name} skill for `);
        }
        renderSelectionOverlay();
        tui.requestRender();
      });
      renderScreenView(
        '⬡ Dexter — Skills',
        'Select a skill to use — press Enter to pre-fill the prompt',
        selector,
        'Enter to use · ↑↓ navigate · Esc to close',
        selector,
      );
      return;
    }

    if (memoryVisible) {
      const panel = new Container();
      if (memoryContent === null) {
        panel.addChild(new Text(theme.muted('  ⏳ Loading memory files…'), 0, 0));
      } else {
        // MEMORY.md section
        panel.addChild(new Text(theme.bold(theme.primary('MEMORY.md')), 0, 0));
        panel.addChild(new Spacer(1));
        if (memoryContent.memory) {
          for (const line of memoryContent.memory.split('\n')) {
            panel.addChild(new Text(`  ${line}`, 0, 0));
          }
        } else {
          panel.addChild(new Text(theme.muted('  (empty)'), 0, 0));
        }
        panel.addChild(new Spacer(1));
        // FINANCE.md section
        panel.addChild(new Text(theme.bold(theme.primary('FINANCE.md')), 0, 0));
        panel.addChild(new Spacer(1));
        if (memoryContent.finance) {
          for (const line of memoryContent.finance.split('\n')) {
            panel.addChild(new Text(`  ${line}`, 0, 0));
          }
        } else {
          panel.addChild(new Text(theme.muted('  (empty)'), 0, 0));
        }
      }
      renderScreenView(
        '⬡ Dexter — Memory',
        'Consolidated long-term memory',
        panel,
        'Esc to close · /dream [force] to consolidate · /dream shows merge conditions',
        editor,
      );
      return;
    }

    if (watchlistVisible) {
      let title: string;
      let subtitle: string;
      let panel: Container;
      let footer: string;

      if (watchlistMode === 'show' && watchlistShowTicker) {
        const snap = watchlistPrices?.get(watchlistShowTicker) ?? null;
        title    = `⬡ Dexter — ${watchlistShowTicker}`;
        subtitle = watchlistPrices === null ? 'Loading…' : (snap ? 'Quick snapshot' : 'Price unavailable');
        panel    = watchlistPrices === null
          ? (() => { const c = new Container(); c.addChild(new Text(theme.muted('  ⏳ Fetching data…'), 0, 0)); return c; })()
          : (snap ? buildShowPanel(watchlistShowTicker, snap) : (() => {
              const c = new Container();
              c.addChild(new Text(theme.error(`  No price data available for ${watchlistShowTicker}`), 0, 0));
              return c;
            })());
        footer   = 'Esc to close · /watchlist list · /watchlist snapshot';
      } else if (watchlistMode === 'snapshot') {
        title    = '⬡ Dexter — Portfolio Snapshot';
        subtitle = watchlistEntries.length === 0 ? 'No positions tracked' : `${watchlistEntries.length} ticker${watchlistEntries.length === 1 ? '' : 's'}`;
        panel    = buildSnapshotPanel(watchlistEntries, watchlistPrices);
        footer   = 'Esc to close · /watchlist list · /watchlist show TICKER';
      } else {
        const loading = watchlistPrices === null;
        title    = '⬡ Dexter — Watchlist';
        subtitle = watchlistEntries.length === 0
          ? 'No positions tracked'
          : loading
            ? `${watchlistEntries.length} position${watchlistEntries.length === 1 ? '' : 's'} — loading prices…`
            : `${watchlistEntries.length} position${watchlistEntries.length === 1 ? '' : 's'}`;
        panel    = buildWatchlistPanel(watchlistEntries, watchlistPrices);
        footer   = 'Esc to close · /watchlist show TICKER · /watchlist snapshot';
      }

      renderWatchlistView(title, subtitle, panel, footer);
      return;
    }

    if (state.appState === 'idle' && !agentRunner.pendingApproval) {
      refreshError();
      renderMainView();
      return;
    }

    if (agentRunner.pendingApproval) {
      const prompt = new ApprovalPromptComponent(
        agentRunner.pendingApproval.tool,
        agentRunner.pendingApproval.args,
      );
      prompt.onSelect = (decision: ApprovalDecision) => {
        agentRunner.respondToApproval(decision);
      };
      renderScreenView('', '', prompt, undefined, prompt.selector);
      return;
    }

    if (state.appState === 'provider_select') {
      const selector = createProviderSelector(modelSelection.provider, (providerId) => {
        void modelSelection.handleProviderSelect(providerId);
      });
      renderScreenView(
        'Select provider',
        'Switch between LLM providers. Applies to this session and future sessions.',
        selector,
        'Enter to confirm · esc to exit',
        selector,
      );
      return;
    }

    if (state.appState === 'model_select' && state.pendingProvider) {
      const selector = createModelSelector(
        state.pendingModels,
        modelSelection.provider === state.pendingProvider ? modelSelection.model : undefined,
        (modelId) => modelSelection.handleModelSelect(modelId),
        state.pendingProvider,
      );
      renderScreenView(
        `Select model for ${getProviderDisplayName(state.pendingProvider)}`,
        '',
        selector,
        'Enter to confirm · esc to go back',
        selector,
      );
      return;
    }

    if (state.appState === 'model_input' && state.pendingProvider) {
      const input = new ApiKeyInputComponent();
      input.onSubmit = (value) => modelSelection.handleModelInputSubmit(value);
      input.onCancel = () => modelSelection.handleModelInputSubmit(null);
      renderScreenView(
        `Enter model name for ${getProviderDisplayName(state.pendingProvider)}`,
        'Type or paste the model name from openrouter.ai/models',
        input,
        'Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b\nEnter to confirm · esc to go back',
        input,
      );
      return;
    }

    if (state.appState === 'api_key_confirm' && state.pendingProvider) {
      const selector = createApiKeyConfirmSelector((wantsToSet) =>
        modelSelection.handleApiKeyConfirm(wantsToSet),
      );
      renderScreenView(
        'Set API Key',
        `Would you like to set your ${getProviderDisplayName(state.pendingProvider)} API key?`,
        selector,
        'Enter to confirm · esc to decline',
        selector,
      );
      return;
    }

    if (state.appState === 'api_key_input' && state.pendingProvider) {
      const input = new ApiKeyInputComponent(true);
      input.onSubmit = (apiKey) => modelSelection.handleApiKeySubmit(apiKey);
      input.onCancel = () => modelSelection.handleApiKeySubmit(null);
      const apiKeyName = getApiKeyNameForProvider(state.pendingProvider) ?? '';
      renderScreenView(
        `Enter ${getProviderDisplayName(state.pendingProvider)} API Key`,
        apiKeyName ? `(${apiKeyName})` : '',
        input,
        'Enter to confirm · Esc to cancel',
        input,
      );
    }
  };

  await inputHistory.init();
  for (const msg of inputHistory.getMessages().reverse()) {
    editor.addToHistory(msg);
  }
  renderSelectionOverlay();
  refreshError();

  tui.start();

  // Seed existing watchlist tickers into financial memory at startup.
  // Ensures recall_financial_context() returns a result for tracked tickers
  // even before any LLM analysis has run for them.
  void (async () => {
    try {
      const existingEntries = new WatchlistController(process.cwd()).list();
      if (existingEntries.length > 0) {
        await seedWatchlistEntries(existingEntries);
      }
    } catch {
      // Non-critical.
    }
  })();

  // Auto-trigger Dream consolidation on startup if conditions are met.
  // Increments the session counter unconditionally, then runs consolidation
  // in the background without blocking the TUI or the user's first query.
  // The 400ms defer ensures the TUI is fully painted before Dream starts,
  // so the user sees a responsive interface even on first launch.
  void (async () => {
    await new Promise<void>((r) => setTimeout(r, 400));
    const dreamStore = new MemoryStore();
    try {
      await incrementDreamSessionCount(dreamStore);
      const [dreamMeta, dreamDailyFiles] = await Promise.all([
        dreamStore.readDreamMeta(),
        dreamStore.listDailyFiles(),
      ]);
      if (!dreamRunning && shouldRunDream(dreamMeta, dreamDailyFiles)) {
        dreamRunning = true;
        intro.setModel('🌙 Dream running…');
        tui.requestRender();
        const result = await runDream(dreamStore, modelSelection.model);
        if (result.ran) {
          const n = result.archivedFiles.length;
          intro.setModel(`✨ Dream: archived ${n} file${n === 1 ? '' : 's'}`);
          tui.requestRender();
          setTimeout(() => { intro.setModel(modelSelection.model); tui.requestRender(); }, 4000);
        } else {
          intro.setModel(modelSelection.model);
          tui.requestRender();
        }
      }
    } catch {
      // Non-fatal — Dream failure must never crash the TUI.
    } finally {
      dreamRunning = false;
    }
  })();
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    process.once('exit', finish);
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });

  workingIndicator.dispose();
  debugPanel.dispose();
}
