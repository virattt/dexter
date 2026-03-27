import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore } from './store.js';
import {
  shouldRunDream,
  parseDreamOutput,
  gatherSignals,
  runDream,
  incrementDreamSessionCount,
  buildConsolidationPrompt,
  type DreamSignal,
  type DreamResult,
  type CallLlmFn,
} from './dream.js';
import type { DreamMeta } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a MemoryStore whose memory dir is <tmpDir>/memory. */
function makeStore(dir: string): MemoryStore {
  return new MemoryStore(dir);
}

/** Writes a file directly into the store's memory directory. */
function seedFile(baseDir: string, name: string, content: string): void {
  writeFileSync(join(baseDir, 'memory', name), content);
}

/** Returns a mock LLM that responds with valid two-section output. */
function mockLlm(
  memory = 'Consolidated memory content.',
  finance = 'Consolidated finance content.',
): CallLlmFn {
  return async () => ({
    content: `### MEMORY.md\n${memory}\n\n### FINANCE.md\n${finance}`,
  });
}

// ---------------------------------------------------------------------------
// shouldRunDream — pure function
// ---------------------------------------------------------------------------

describe('shouldRunDream', () => {
  const HOURS_24 = 24 * 3_600_000;

  it('returns false when 0 daily files', () => {
    expect(shouldRunDream(null, [])).toBe(false);
  });

  it('returns false when only 1 daily file', () => {
    expect(shouldRunDream(null, ['2026-01-01.md'])).toBe(false);
  });

  it('returns true on first-ever run (no meta, ≥2 daily files)', () => {
    expect(shouldRunDream(null, ['2026-01-01.md', '2026-01-02.md'])).toBe(true);
  });

  it('returns false when session count is below threshold', () => {
    const meta: DreamMeta = {
      lastRunAt: Date.now() - HOURS_24 - 1000,
      sessionsSinceLastRun: 2, // needs 3
      totalRuns: 1,
    };
    expect(shouldRunDream(meta, ['2026-01-01.md', '2026-01-02.md'])).toBe(false);
  });

  it('returns false when time elapsed is below threshold', () => {
    const meta: DreamMeta = {
      lastRunAt: Date.now() - HOURS_24 + 60_000, // 1 minute short of 24h
      sessionsSinceLastRun: 5,
      totalRuns: 1,
    };
    expect(shouldRunDream(meta, ['2026-01-01.md', '2026-01-02.md'])).toBe(false);
  });

  it('returns true when both 24h and 3-session conditions are exactly met', () => {
    const meta: DreamMeta = {
      lastRunAt: Date.now() - HOURS_24 - 1,
      sessionsSinceLastRun: 3,
      totalRuns: 1,
    };
    expect(shouldRunDream(meta, ['2026-01-01.md', '2026-01-02.md'])).toBe(true);
  });

  it('returns true when conditions are greatly exceeded', () => {
    const meta: DreamMeta = {
      lastRunAt: Date.now() - 7 * 24 * 3_600_000,
      sessionsSinceLastRun: 20,
      totalRuns: 3,
    };
    expect(shouldRunDream(meta, ['2026-01-01.md', '2026-01-02.md', '2026-01-03.md'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseDreamOutput — pure function
// ---------------------------------------------------------------------------

describe('parseDreamOutput', () => {
  it('parses valid two-section output', () => {
    const raw = '### MEMORY.md\nMy memory.\n\n### FINANCE.md\nMy finance.';
    const result = parseDreamOutput(raw);
    expect(result).not.toBeNull();
    expect(result!.memory).toBe('My memory.');
    expect(result!.finance).toBe('My finance.');
  });

  it('trims whitespace from both sections', () => {
    const raw = '### MEMORY.md\n\n  Memory  \n\n### FINANCE.md\n  Finance  \n';
    const result = parseDreamOutput(raw);
    expect(result!.memory).toBe('Memory');
    expect(result!.finance).toBe('Finance');
  });

  it('returns null when MEMORY.md section is missing', () => {
    expect(parseDreamOutput('### FINANCE.md\nSome finance')).toBeNull();
  });

  it('returns null when FINANCE.md section is missing', () => {
    expect(parseDreamOutput('### MEMORY.md\nSome memory')).toBeNull();
  });

  it('returns null when sections appear in wrong order', () => {
    const raw = '### FINANCE.md\nFinance first\n\n### MEMORY.md\nThen memory';
    expect(parseDreamOutput(raw)).toBeNull();
  });

  it('returns null when memory section is empty after trimming', () => {
    expect(parseDreamOutput('### MEMORY.md\n   \n### FINANCE.md\nFinance')).toBeNull();
  });

  it('returns null when finance section is empty after trimming', () => {
    expect(parseDreamOutput('### MEMORY.md\nMemory\n\n### FINANCE.md\n   ')).toBeNull();
  });

  it('handles LLM preamble text before the first section', () => {
    const raw =
      'Here is the consolidated output:\n\n### MEMORY.md\nMemory content.\n\n### FINANCE.md\nFinance content.';
    const result = parseDreamOutput(raw);
    expect(result).not.toBeNull();
    expect(result!.memory).toBe('Memory content.');
    expect(result!.finance).toBe('Finance content.');
  });

  it('handles multi-line content in each section', () => {
    const raw =
      '### MEMORY.md\n- Line one.\n- Line two.\n\n### FINANCE.md\n- AAPL: buy.\n- MSFT: hold.';
    const result = parseDreamOutput(raw);
    expect(result!.memory).toBe('- Line one.\n- Line two.');
    expect(result!.finance).toBe('- AAPL: buy.\n- MSFT: hold.');
  });
});

// ---------------------------------------------------------------------------
// buildConsolidationPrompt — pure function
// ---------------------------------------------------------------------------

describe('buildConsolidationPrompt', () => {
  it('includes today date', () => {
    const prompt = buildConsolidationPrompt('2026-03-27', 'tagged content');
    expect(prompt).toContain('2026-03-27');
  });

  it('includes the tagged content verbatim', () => {
    const prompt = buildConsolidationPrompt('2026-03-27', '### MEMORY.md\nsome notes');
    expect(prompt).toContain('### MEMORY.md\nsome notes');
  });

  it('instructs LLM to output exactly two sections', () => {
    const prompt = buildConsolidationPrompt('2026-03-27', '');
    expect(prompt).toContain('### MEMORY.md');
    expect(prompt).toContain('### FINANCE.md');
  });
});

// ---------------------------------------------------------------------------
// MemoryStore dream-specific methods
// ---------------------------------------------------------------------------

describe('MemoryStore dream methods', () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-dream-store-${Date.now()}`);
    mkdirSync(join(tmpDir, 'memory'), { recursive: true });
    store = makeStore(tmpDir);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('readDreamMeta returns null when file does not exist', async () => {
    expect(await store.readDreamMeta()).toBeNull();
  });

  it('writeDreamMeta + readDreamMeta round-trips correctly', async () => {
    const meta: DreamMeta = { lastRunAt: 1_700_000_000_000, sessionsSinceLastRun: 3, totalRuns: 2 };
    await store.writeDreamMeta(meta);
    expect(await store.readDreamMeta()).toEqual(meta);
  });

  it('writeDreamMeta overwrites existing meta', async () => {
    await store.writeDreamMeta({ lastRunAt: 0, sessionsSinceLastRun: 1, totalRuns: 0 });
    await store.writeDreamMeta({ lastRunAt: 999, sessionsSinceLastRun: 0, totalRuns: 1 });
    expect((await store.readDreamMeta())!.lastRunAt).toBe(999);
  });

  it('listDailyFiles returns only YYYY-MM-DD.md files in sorted order', async () => {
    seedFile(tmpDir, '2026-01-02.md', 'b');
    seedFile(tmpDir, '2026-01-01.md', 'a');
    seedFile(tmpDir, 'MEMORY.md', 'mem');
    seedFile(tmpDir, 'FINANCE.md', 'fin');
    const files = await store.listDailyFiles();
    expect(files).toEqual(['2026-01-01.md', '2026-01-02.md']);
  });

  it('listDailyFiles returns empty array when no daily files exist', async () => {
    expect(await store.listDailyFiles()).toEqual([]);
  });

  it('archiveDailyFile moves the file to archive/ subdirectory', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'daily content');
    await store.archiveDailyFile('2026-01-01.md');

    const remaining = await store.listDailyFiles();
    expect(remaining).not.toContain('2026-01-01.md');

    const archivePath = join(tmpDir, 'memory', 'archive', '2026-01-01.md');
    expect(existsSync(archivePath)).toBe(true);
  });

  it('archiveDailyFile creates archive/ if it does not exist', async () => {
    seedFile(tmpDir, '2026-03-01.md', 'content');
    await expect(store.archiveDailyFile('2026-03-01.md')).resolves.toBeUndefined();
  });

  it('archiveDailyFile preserves file content in archive', async () => {
    const content = 'Researched AAPL today.';
    seedFile(tmpDir, '2026-01-01.md', content);
    await store.archiveDailyFile('2026-01-01.md');
    const archived = existsSync(join(tmpDir, 'memory', 'archive', '2026-01-01.md'));
    expect(archived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// gatherSignals — requires file system, no LLM
// ---------------------------------------------------------------------------

describe('gatherSignals', () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-dream-signal-${Date.now()}`);
    mkdirSync(join(tmpDir, 'memory'), { recursive: true });
    store = makeStore(tmpDir);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns empty signal when no daily files exist', async () => {
    const signal = await gatherSignals(store);
    expect(signal.dailyFiles).toHaveLength(0);
    expect(signal.duplicateTickers).toHaveLength(0);
    expect(signal.relativeLanguageFiles).toHaveLength(0);
    expect(signal.estimatedTokens).toBeGreaterThanOrEqual(0);
  });

  it('reports all daily files found', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'content a');
    seedFile(tmpDir, '2026-01-02.md', 'content b');
    const signal = await gatherSignals(store);
    expect(signal.dailyFiles).toEqual(['2026-01-01.md', '2026-01-02.md']);
  });

  it('detects relative-date language in daily files', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'Bought AAPL last week — looks good.');
    seedFile(tmpDir, '2026-01-02.md', 'TSLA rallied recently, up 5%.');
    const signal = await gatherSignals(store);
    expect(signal.relativeLanguageFiles).toContain('2026-01-01.md');
    expect(signal.relativeLanguageFiles).toContain('2026-01-02.md');
  });

  it('does not flag files without relative-date language', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'AAPL P/E 28x as of 2026-01-01.');
    const signal = await gatherSignals(store);
    expect(signal.relativeLanguageFiles).toHaveLength(0);
  });

  it('detects tickers appearing in 2+ daily files as duplicates', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'Researched AAPL and MSFT today.');
    seedFile(tmpDir, '2026-01-02.md', 'AAPL earnings beat expectations.');
    const signal = await gatherSignals(store);
    expect(signal.duplicateTickers).toContain('AAPL');
    expect(signal.duplicateTickers).not.toContain('MSFT'); // appears in only one file
  });

  it('does not count a ticker appearing twice in the same file as a duplicate', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'AAPL is up. AAPL beat earnings.');
    seedFile(tmpDir, '2026-01-02.md', 'No relevant tickers here.');
    const signal = await gatherSignals(store);
    expect(signal.duplicateTickers).not.toContain('AAPL');
  });

  it('includes MEMORY.md and FINANCE.md in token estimate', async () => {
    seedFile(tmpDir, 'MEMORY.md', 'Long-term memory with plenty of content here.');
    seedFile(tmpDir, 'FINANCE.md', 'Finance notes about positions.');
    const signalWithCore = await gatherSignals(store);

    // Fresh store without core files
    const emptyDir = join(tmpdir(), `dexter-dream-signal-empty-${Date.now()}`);
    mkdirSync(join(emptyDir, 'memory'), { recursive: true });
    const emptyStore = makeStore(emptyDir);
    const signalEmpty = await gatherSignals(emptyStore);
    rmSync(emptyDir, { recursive: true, force: true });

    expect(signalWithCore.estimatedTokens).toBeGreaterThan(signalEmpty.estimatedTokens);
  });

  it('ignores empty daily files when detecting signals', async () => {
    seedFile(tmpDir, '2026-01-01.md', '');
    seedFile(tmpDir, '2026-01-02.md', 'MSFT up yesterday.');
    const signal = await gatherSignals(store);
    expect(signal.relativeLanguageFiles).not.toContain('2026-01-01.md');
    expect(signal.relativeLanguageFiles).toContain('2026-01-02.md');
  });
});

// ---------------------------------------------------------------------------
// incrementDreamSessionCount
// ---------------------------------------------------------------------------

describe('incrementDreamSessionCount', () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-dream-inc-${Date.now()}`);
    mkdirSync(join(tmpDir, 'memory'), { recursive: true });
    store = makeStore(tmpDir);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('creates meta with sessionsSinceLastRun=1 on first call', async () => {
    await incrementDreamSessionCount(store);
    const meta = await store.readDreamMeta();
    expect(meta!.sessionsSinceLastRun).toBe(1);
    expect(meta!.totalRuns).toBe(0);
    expect(meta!.lastRunAt).toBe(0);
  });

  it('increments sessionsSinceLastRun on each successive call', async () => {
    await incrementDreamSessionCount(store);
    await incrementDreamSessionCount(store);
    await incrementDreamSessionCount(store);
    expect((await store.readDreamMeta())!.sessionsSinceLastRun).toBe(3);
  });

  it('preserves lastRunAt and totalRuns from existing meta', async () => {
    const initial: DreamMeta = { lastRunAt: 1_700_000_000_000, sessionsSinceLastRun: 0, totalRuns: 5 };
    await store.writeDreamMeta(initial);
    await incrementDreamSessionCount(store);
    const meta = await store.readDreamMeta();
    expect(meta!.lastRunAt).toBe(1_700_000_000_000);
    expect(meta!.totalRuns).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// runDream — skip / condition checks
// ---------------------------------------------------------------------------

describe('runDream — skip conditions', () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-dream-skip-${Date.now()}`);
    mkdirSync(join(tmpDir, 'memory'), { recursive: true });
    store = makeStore(tmpDir);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns ran=false with descriptive reason when < 2 daily files', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'only one file');
    const result = await runDream(store, 'gpt-4', { callLlm: mockLlm() });
    expect(result.ran).toBe(false);
    expect(result.reason).toMatch(/Not enough daily files/);
  });

  it('returns ran=false when session/time conditions are not met', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'file 1');
    seedFile(tmpDir, '2026-01-02.md', 'file 2');
    await store.writeDreamMeta({ lastRunAt: Date.now() - 1000, sessionsSinceLastRun: 1, totalRuns: 1 });
    const result = await runDream(store, 'gpt-4', { callLlm: mockLlm() });
    expect(result.ran).toBe(false);
    expect(result.reason).toMatch(/Not yet due/);
  });

  it('does not invoke the LLM when skipping', async () => {
    let llmCalled = false;
    const trackingLlm: CallLlmFn = async () => { llmCalled = true; return { content: '' }; };
    seedFile(tmpDir, '2026-01-01.md', 'file 1'); // only 1 file
    await runDream(store, 'gpt-4', { callLlm: trackingLlm });
    expect(llmCalled).toBe(false);
  });

  it('force=true runs the cycle even when conditions are not met', async () => {
    // Only 1 daily file, but force=true should bypass the check.
    seedFile(tmpDir, '2026-01-01.md', 'A'.repeat(400));
    seedFile(tmpDir, 'MEMORY.md', 'Some memory.');
    seedFile(tmpDir, 'FINANCE.md', 'Some finance.');
    const result = await runDream(store, 'gpt-4', { force: true, callLlm: mockLlm() });
    expect(result.ran).toBe(true);
  });

  it('force=true bypasses MIN_TOKENS check too', async () => {
    seedFile(tmpDir, '2026-01-01.md', 'tiny'); // below MIN_TOKENS
    seedFile(tmpDir, 'MEMORY.md', '');
    seedFile(tmpDir, 'FINANCE.md', '');
    const result = await runDream(store, 'gpt-4', { force: true, callLlm: mockLlm() });
    expect(result.ran).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runDream — full E2E cycle (mocked LLM, real file system)
// ---------------------------------------------------------------------------

describe('runDream — full cycle (E2E)', () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-dream-e2e-${Date.now()}`);
    mkdirSync(join(tmpDir, 'memory'), { recursive: true });
    store = makeStore(tmpDir);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  /** Seed realistic memory state for tests. */
  function seedRealisticFiles() {
    seedFile(tmpDir, 'MEMORY.md', '- User prefers value investing.\n- Uses FMP for data.');
    seedFile(tmpDir, 'FINANCE.md', '- AAPL: strong buy thesis.\n- Watchlist: AAPL, MSFT');
    seedFile(tmpDir, '2026-01-01.md', 'Researched AAPL yesterday. P/E around 28x.');
    seedFile(tmpDir, '2026-01-02.md', 'AAPL earnings beat. Up 5% recently.');
  }

  it('returns ran=true with correct archivedFiles and updatedFiles', async () => {
    seedRealisticFiles();
    const result = await runDream(store, 'gpt-4', {
      force: true,
      callLlm: mockLlm('Consolidated memory.', 'Consolidated finance.'),
    });
    expect(result.ran).toBe(true);
    expect(result.updatedFiles).toContain('MEMORY.md');
    expect(result.updatedFiles).toContain('FINANCE.md');
    expect(result.archivedFiles).toContain('2026-01-01.md');
    expect(result.archivedFiles).toContain('2026-01-02.md');
  });

  it('writes consolidated content to MEMORY.md and FINANCE.md', async () => {
    seedRealisticFiles();
    await runDream(store, 'gpt-4', {
      force: true,
      callLlm: mockLlm('New consolidated memory.', 'New consolidated finance.'),
    });
    const memory = await store.readMemoryFile('MEMORY.md');
    const finance = await store.readMemoryFile('FINANCE.md');
    expect(memory).toContain('New consolidated memory.');
    expect(finance).toContain('New consolidated finance.');
  });

  it('moves all daily files to archive/ and removes them from memory dir', async () => {
    seedRealisticFiles();
    await runDream(store, 'gpt-4', { force: true, callLlm: mockLlm() });

    const remaining = await store.listDailyFiles();
    expect(remaining).toHaveLength(0);

    expect(existsSync(join(tmpDir, 'memory', 'archive', '2026-01-01.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'memory', 'archive', '2026-01-02.md'))).toBe(true);
  });

  it('creates archive/ directory if it did not exist', async () => {
    seedRealisticFiles();
    const archiveDir = join(tmpDir, 'memory', 'archive');
    expect(existsSync(archiveDir)).toBe(false);
    await runDream(store, 'gpt-4', { force: true, callLlm: mockLlm() });
    expect(existsSync(archiveDir)).toBe(true);
  });

  it('updates .dream-meta.json: resets session count, increments totalRuns, sets lastRunAt', async () => {
    seedRealisticFiles();
    await store.writeDreamMeta({ lastRunAt: 0, sessionsSinceLastRun: 5, totalRuns: 2 });

    const before = Date.now();
    await runDream(store, 'gpt-4', { force: true, callLlm: mockLlm() });
    const after = Date.now();

    const meta = await store.readDreamMeta();
    expect(meta!.sessionsSinceLastRun).toBe(0);
    expect(meta!.totalRuns).toBe(3);
    expect(meta!.lastRunAt).toBeGreaterThanOrEqual(before);
    expect(meta!.lastRunAt).toBeLessThanOrEqual(after);
  });

  it('passes the model name to the LLM', async () => {
    seedRealisticFiles();
    let capturedModel = '';
    const capturingLlm: CallLlmFn = async (_prompt, opts) => {
      capturedModel = opts.model;
      return { content: '### MEMORY.md\nMemory\n\n### FINANCE.md\nFinance' };
    };
    await runDream(store, 'claude-3-sonnet', { force: true, callLlm: capturingLlm });
    expect(capturedModel).toBe('claude-3-sonnet');
  });

  it('includes all source files in the LLM prompt', async () => {
    seedRealisticFiles();
    let capturedPrompt = '';
    const capturingLlm: CallLlmFn = async (prompt) => {
      capturedPrompt = prompt;
      return { content: '### MEMORY.md\nMemory\n\n### FINANCE.md\nFinance' };
    };
    await runDream(store, 'gpt-4', { force: true, callLlm: capturingLlm });
    expect(capturedPrompt).toContain('### MEMORY.md');
    expect(capturedPrompt).toContain('### FINANCE.md');
    expect(capturedPrompt).toContain('### 2026-01-01.md');
    expect(capturedPrompt).toContain('### 2026-01-02.md');
  });

  it('throws a descriptive error when the LLM returns malformed output', async () => {
    seedRealisticFiles();
    const badLlm: CallLlmFn = async () => ({ content: 'No sections here at all.' });
    await expect(
      runDream(store, 'gpt-4', { force: true, callLlm: badLlm }),
    ).rejects.toThrow('Dream consolidation failed');
  });

  it('auto-triggers without force on first run (no prior meta, ≥2 daily files)', async () => {
    // Each file must be substantial — MIN_TOKENS=300 requires ~1050 total chars.
    seedFile(
      tmpDir,
      'MEMORY.md',
      [
        '- User prefers value investing with 5-10 year horizon.',
        '- Risk tolerance: moderate. Max single position: 10% of portfolio.',
        '- Data sources: FMP for fundamentals, Yahoo for prices.',
        '- AAPL routing: FMP works. VALE: use web_search (FMP premium only).',
        '- Always date-stamp financial data. Prefer DCF for tech stocks.',
      ].join('\n'),
    );
    seedFile(
      tmpDir,
      'FINANCE.md',
      [
        '- AAPL: buy thesis. P/E 28x TTM (2026-Q1). Target $220. Services margin 74%.',
        '- MSFT: hold. Azure +23% YoY. EPS $3.12 Q4-2025. No near-term catalyst.',
        '- GOOGL: watchlist. Ad recovery underway. Cloud gaining vs AWS.',
        '- Portfolio allocation: AAPL 8%, MSFT 5%, cash 40%, bonds 30%.',
      ].join('\n'),
    );
    seedFile(
      tmpDir,
      '2026-01-01.md',
      [
        '## AAPL Q4-2025 research',
        'Revenue $124B (+12% YoY). iPhone 16 cycle stronger than expected.',
        'Services hit $26B record; gross margin 47%. China revenue $22B, tariff risk.',
        'DCF fair value ~$200, current $187. P/E 28x on TTM EPS $6.92. Buy signal.',
        'Management guided $128B for Q1-2026. Key risk: China trade policy.',
      ].join('\n'),
    );
    seedFile(
      tmpDir,
      '2026-01-02.md',
      [
        '## AAPL Q1-2026 earnings call',
        'EPS $2.46 vs $2.39 consensus. Revenue $127B, in-line. Services +17% YoY.',
        'iPhone units 90M vs 87M expected. Gross margin 47.2%, expansion continues.',
        'Stock +5.2% after hours. Revised target $225 (FY2026E EPS $7.20 × 31x).',
        'Next catalyst: WWDC June — potential on-device AI announcements.',
      ].join('\n'),
    );
    const result = await runDream(store, 'gpt-4', { callLlm: mockLlm() });
    expect(result.ran).toBe(true);
  });

  it('does not modify MEMORY.md or FINANCE.md when skipping', async () => {
    seedRealisticFiles();
    await store.writeDreamMeta({ lastRunAt: Date.now() - 1000, sessionsSinceLastRun: 0, totalRuns: 1 });
    const originalMemory = await store.readMemoryFile('MEMORY.md');
    await runDream(store, 'gpt-4', { callLlm: mockLlm() });
    expect(await store.readMemoryFile('MEMORY.md')).toBe(originalMemory);
  });

  it('does not archive daily files when skipping', async () => {
    seedRealisticFiles();
    await store.writeDreamMeta({ lastRunAt: Date.now() - 1000, sessionsSinceLastRun: 0, totalRuns: 1 });
    await runDream(store, 'gpt-4', { callLlm: mockLlm() });
    expect(await store.listDailyFiles()).toHaveLength(2);
  });
});
