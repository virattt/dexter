import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dexterPath } from '../utils/paths.js';

export interface WatchlistEntry {
  ticker: string;
  costBasis?: number;
  shares?: number;
  addedAt: string; // "YYYY-MM-DD"
}

export interface WatchlistFile {
  version: 1;
  entries: WatchlistEntry[];
}

// ---------------------------------------------------------------------------
// Pure helper — exported so the CLI can unit-test it independently.
// ---------------------------------------------------------------------------

export type WatchlistSubcommand =
  | { cmd: 'briefing' }
  | { cmd: 'add'; ticker: string; costBasis?: number; shares?: number }
  | { cmd: 'remove'; ticker: string }
  | { cmd: 'list' };

/**
 * Parse the text that follows "/watchlist" into a typed subcommand.
 * Input examples: "", "add NVDA 400 100", "remove AAPL", "list"
 */
export function parseWatchlistSubcommand(raw: string): WatchlistSubcommand {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { cmd: 'briefing' };

  const sub = parts[0]!.toLowerCase();

  if (sub === 'add') {
    const ticker = parts[1]?.toUpperCase();
    if (!ticker) return { cmd: 'briefing' };
    const costBasis = parts[2] !== undefined ? Number(parts[2]) : undefined;
    const shares = parts[3] !== undefined ? Number(parts[3]) : undefined;
    return {
      cmd: 'add',
      ticker,
      costBasis: costBasis !== undefined && !isNaN(costBasis) ? costBasis : undefined,
      shares: shares !== undefined && !isNaN(shares) ? shares : undefined,
    };
  }

  if (sub === 'remove') {
    const ticker = parts[1]?.toUpperCase();
    if (!ticker) return { cmd: 'briefing' };
    return { cmd: 'remove', ticker };
  }

  if (sub === 'list') {
    return { cmd: 'list' };
  }

  return { cmd: 'briefing' };
}

// ---------------------------------------------------------------------------
// WatchlistController
// ---------------------------------------------------------------------------

const EMPTY_FILE: WatchlistFile = { version: 1, entries: [] };

export class WatchlistController {
  private readonly filePath: string;

  constructor(baseDir: string = process.cwd()) {
    this.filePath = join(baseDir, dexterPath('watchlist.json'));
  }

  load(): WatchlistFile {
    if (!existsSync(this.filePath)) {
      return { version: 1, entries: [] };
    }
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as WatchlistFile;
    } catch {
      return { ...EMPTY_FILE };
    }
  }

  save(data: WatchlistFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  add(ticker: string, costBasis?: number, shares?: number): void {
    ticker = ticker.toUpperCase();
    const data = this.load();
    const idx = data.entries.findIndex((e) => e.ticker === ticker);
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const entry: WatchlistEntry = { ticker, addedAt: today };
    if (costBasis !== undefined) entry.costBasis = costBasis;
    if (shares !== undefined) entry.shares = shares;

    if (idx >= 0) {
      data.entries[idx] = entry;
    } else {
      data.entries.push(entry);
    }
    this.save(data);
  }

  remove(ticker: string): void {
    ticker = ticker.toUpperCase();
    const data = this.load();
    data.entries = data.entries.filter((e) => e.ticker !== ticker);
    this.save(data);
  }

  list(): WatchlistEntry[] {
    return [...this.load().entries].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  isEmpty(): boolean {
    return this.load().entries.length === 0;
  }
}
