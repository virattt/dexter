/**
 * Dream — Memory Consolidation
 *
 * Inspired by Claude Code's AutoDream, this module runs a 4-phase memory
 * consolidation cycle between sessions:
 *
 *   Phase 1 — Orientation   : read meta, enumerate files, estimate token load
 *   Phase 2 — Signal Gather : detect duplicates, stale language, ticker spread
 *   Phase 3 — Consolidation : LLM merges/prunes all memory files into two clean outputs
 *   Phase 4 — Rewrite       : persist updated MEMORY.md + FINANCE.md, archive daily files
 *
 * Auto-trigger conditions (both must hold):
 *   • 24 h elapsed since last Dream run
 *   • ≥ 3 sessions accumulated since last Dream run
 *   • ≥ 2 daily YYYY-MM-DD.md files exist to consolidate
 *
 * Manual trigger: `/dream` (or `/dream force` to bypass conditions).
 */

import type { DreamMeta } from './types.js';
import type { MemoryStore } from './store.js';
import { extractTickers } from './ticker-extractor.js';
import { callLlm as realCallLlm } from '../model/llm.js';
import { estimateTokens } from '../utils/tokens.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RELATIVE_DATE_RE =
  /\b(yesterday|last week|last month|recently|this morning|a few days ago|earlier today|the other day|a while ago)\b/gi;

const MIN_DAILY_FILES = 2;
const MIN_TOKENS = 300;
const TRIGGER_HOURS = 24;
const TRIGGER_SESSIONS = 3;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DreamSignal {
  /** YYYY-MM-DD.md files present in the memory directory. */
  dailyFiles: string[];
  /** Tickers that appear in 2+ distinct daily files (candidates for deduplication). */
  duplicateTickers: string[];
  /** Daily files that contain stale relative-date language. */
  relativeLanguageFiles: string[];
  /** Estimated total token count across all memory files. */
  estimatedTokens: number;
}

export interface DreamResult {
  ran: boolean;
  /** Human-readable reason the dream was skipped (only set when ran=false). */
  reason?: string;
  /** Daily files moved to the archive/ subdirectory. */
  archivedFiles: string[];
  /** Core memory files rewritten by the cycle. */
  updatedFiles: string[];
}

/** Minimal LLM call shape — allows easy test injection without mocking modules. */
export type CallLlmFn = (
  prompt: string,
  opts: { model: string },
) => Promise<{ content: string }>;

/**
 * Adapter that wraps the real callLlm and extracts the text content string.
 * Used as the default in production; tests inject their own CallLlmFn directly.
 */
async function defaultCallLlm(prompt: string, opts: { model: string }): Promise<{ content: string }> {
  // Disable thinking for dream consolidation: output must be parseable plain text.
  const result = await realCallLlm(prompt, { model: opts.model, thinkOverride: false });
  const raw = result.response;
  if (typeof raw === 'string') return { content: raw };
  const rawContent = (raw as { content?: unknown }).content;
  if (typeof rawContent === 'string') return { content: rawContent };
  // Thinking models may still return array blocks even with thinkOverride; extract text.
  if (Array.isArray(rawContent)) {
    const text = rawContent
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === 'object' &&
          b !== null &&
          (b as { type?: unknown }).type === 'text' &&
          typeof (b as { text?: unknown }).text === 'string',
      )
      .map((b) => b.text)
      .join('');
    return { content: text };
  }
  return { content: '' };
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O — fully unit-testable)
// ---------------------------------------------------------------------------

/**
 * Returns true when the Dream cycle should auto-run.
 * Pure function — no I/O, no side effects.
 */
export function shouldRunDream(
  meta: DreamMeta | null,
  dailyFiles: string[],
): boolean {
  if (dailyFiles.length < MIN_DAILY_FILES) return false;
  if (!meta) return true; // Never run before — trigger immediately.
  const elapsedMs = Date.now() - meta.lastRunAt;
  return (
    elapsedMs >= TRIGGER_HOURS * 3_600_000 &&
    meta.sessionsSinceLastRun >= TRIGGER_SESSIONS
  );
}

/**
 * Parses the two-section LLM output into { memory, finance }.
 * Returns null when the output is malformed (missing or misordered sections).
 * Exported for direct unit testing.
 */
export function parseDreamOutput(raw: string): { memory: string; finance: string } | null {
  // Accept 2–4 leading '#' chars (## / ### / ####) in any combination.
  const MEM_RE = /#{2,4}\s*MEMORY\.md/i;
  const FIN_RE = /#{2,4}\s*FINANCE\.md/i;
  const memMatch = MEM_RE.exec(raw);
  const finMatch = FIN_RE.exec(raw);
  if (!memMatch || !finMatch) return null;
  const memIdx = memMatch.index;
  const finIdx = finMatch.index;
  if (finIdx <= memIdx) return null;

  const memory = raw.slice(memIdx + memMatch[0].length, finIdx).trim();
  const finance = raw.slice(finIdx + finMatch[0].length).trim();
  if (!memory || !finance) return null;

  return { memory, finance };
}

// ---------------------------------------------------------------------------
// Phase 1 + 2 — Orientation & Signal gathering
// ---------------------------------------------------------------------------

/** Analyses all memory files and returns a signal report. No LLM involved. */
export async function gatherSignals(store: MemoryStore): Promise<DreamSignal> {
  const dailyFiles = await store.listDailyFiles();
  let estimatedTokens = 0;
  const relativeLanguageFiles: string[] = [];
  const tickerMap = new Map<string, Set<string>>(); // ticker → set of files it appears in

  // Include core files in the token estimate.
  for (const filename of ['MEMORY.md', 'FINANCE.md']) {
    const content = await store.readMemoryFile(filename);
    estimatedTokens += estimateTokens(content);
  }

  for (const filename of dailyFiles) {
    const content = await store.readMemoryFile(filename);
    if (!content.trim()) continue;

    estimatedTokens += estimateTokens(content);

    // Detect stale relative-date language (reset lastIndex for global regex).
    RELATIVE_DATE_RE.lastIndex = 0;
    if (RELATIVE_DATE_RE.test(content)) {
      relativeLanguageFiles.push(filename);
    }

    // Track which tickers appear in which files.
    for (const ticker of extractTickers(content)) {
      if (!tickerMap.has(ticker)) tickerMap.set(ticker, new Set());
      tickerMap.get(ticker)!.add(filename);
    }
  }

  const duplicateTickers = [...tickerMap.entries()]
    .filter(([, files]) => files.size >= 2)
    .map(([ticker]) => ticker)
    .sort();

  return { dailyFiles, duplicateTickers, relativeLanguageFiles, estimatedTokens };
}

// ---------------------------------------------------------------------------
// Phase 3 — Consolidation prompt builder (pure, exported for testing)
// ---------------------------------------------------------------------------

export function buildConsolidationPrompt(today: string, taggedContent: string): string {
  return `You are a financial memory consolidation assistant. Today is ${today}.

Consolidate the tagged memory files below into two clean output sections.

Rules:
- Merge duplicate ticker information — keep the most recent, most specific data.
- Remove vague relative timestamps ("last week", "recently", "yesterday") — replace with the source file date if inferable, otherwise omit.
- Resolve contradictions by keeping the most recent file's value; note the date inline.
- Preserve all P1 (critical) and P2 (important) notes unchanged.
- Remove clearly stale or low-value P3/P4 noise.
- MEMORY.md: general research context, user preferences, procedural notes.
- FINANCE.md: positions, watchlist context, financial theses, portfolio notes.

Output EXACTLY two sections in this format — no other text before, between, or after:

### MEMORY.md
<consolidated long-term memory>

### FINANCE.md
<consolidated financial memory>

---
${taggedContent}`;
}

// ---------------------------------------------------------------------------
// Phase 3 + 4 — LLM consolidation + rewrite + archive
// ---------------------------------------------------------------------------

async function consolidate(
  store: MemoryStore,
  signal: DreamSignal,
  model: string,
  callLlmFn: CallLlmFn,
): Promise<DreamResult> {
  // Build tagged content from all memory files.
  const sections: string[] = [];
  for (const filename of ['MEMORY.md', 'FINANCE.md']) {
    const content = (await store.readMemoryFile(filename)).trim();
    if (content) sections.push(`### ${filename}\n${content}`);
  }
  for (const filename of signal.dailyFiles) {
    const content = (await store.readMemoryFile(filename)).trim();
    if (content) sections.push(`### ${filename}\n${content}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildConsolidationPrompt(today, sections.join('\n\n---\n\n'));

  const result = await callLlmFn(prompt, { model });
  const parsed = parseDreamOutput(result.content ?? '');

  if (!parsed) {
    throw new Error(
      'Dream consolidation failed: LLM output missing required ### MEMORY.md / ### FINANCE.md sections',
    );
  }

  // Phase 4: write consolidated files.
  await store.writeMemoryFile('MEMORY.md', parsed.memory + '\n');
  await store.writeMemoryFile('FINANCE.md', parsed.finance + '\n');

  // Archive processed daily files (moves to archive/ subdirectory).
  const archivedFiles: string[] = [];
  for (const filename of signal.dailyFiles) {
    await store.archiveDailyFile(filename);
    archivedFiles.push(filename);
  }

  // Update dream meta: reset session counter, increment total runs.
  const meta = await store.readDreamMeta();
  await store.writeDreamMeta({
    lastRunAt: Date.now(),
    sessionsSinceLastRun: 0,
    totalRuns: (meta?.totalRuns ?? 0) + 1,
  });

  return { ran: true, archivedFiles, updatedFiles: ['MEMORY.md', 'FINANCE.md'] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Increments the session counter in .dream-meta.json.
 * Call once on each session start (before the user's first query).
 */
export async function incrementDreamSessionCount(store: MemoryStore): Promise<void> {
  const meta = await store.readDreamMeta();
  await store.writeDreamMeta({
    lastRunAt: meta?.lastRunAt ?? 0,
    sessionsSinceLastRun: (meta?.sessionsSinceLastRun ?? 0) + 1,
    totalRuns: meta?.totalRuns ?? 0,
  });
}

/**
 * Runs the Dream consolidation cycle.
 *
 * @param store    Memory store instance (real or injected for tests).
 * @param model    LLM model identifier string.
 * @param options  force=true bypasses condition checks; callLlm for test injection.
 */
export async function runDream(
  store: MemoryStore,
  model: string,
  options: { force?: boolean; callLlm?: CallLlmFn } = {},
): Promise<DreamResult> {
  const { force = false, callLlm: callLlmFn = defaultCallLlm } = options;

  const [meta, dailyFiles] = await Promise.all([
    store.readDreamMeta(),
    store.listDailyFiles(),
  ]);

  if (!force && !shouldRunDream(meta, dailyFiles)) {
    const sessions = meta?.sessionsSinceLastRun ?? 0;
    const elapsedH = Math.floor((Date.now() - (meta?.lastRunAt ?? 0)) / 3_600_000);
    const reason =
      dailyFiles.length < MIN_DAILY_FILES
        ? `Not enough daily files (${dailyFiles.length}/${MIN_DAILY_FILES} required)`
        : `Not yet due — ${sessions}/${TRIGGER_SESSIONS} sessions, ${elapsedH}h/${TRIGGER_HOURS}h elapsed`;
    return { ran: false, reason, archivedFiles: [], updatedFiles: [] };
  }

  // Phase 2: gather signals.
  const signal = await gatherSignals(store);

  // Skip if total content is too sparse (unless forced).
  if (!force && signal.estimatedTokens < MIN_TOKENS) {
    return {
      ran: false,
      reason: `Content too sparse (${signal.estimatedTokens} tokens, ${MIN_TOKENS} minimum)`,
      archivedFiles: [],
      updatedFiles: [],
    };
  }

  // Phase 3 + 4: LLM consolidation + rewrite.
  return consolidate(store, signal, model, callLlmFn);
}
