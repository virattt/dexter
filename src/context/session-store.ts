import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { BaseMessage } from '@langchain/core/messages';
import { callLlm } from '../model/llm.js';
import { resolveProvider } from '../providers.js';
import { dexterPath } from '../utils/paths.js';
import {
  DEFAULT_HISTORY_LIMIT,
  HISTORY_PREVIEW_CHARS,
  MAX_NOTE_BYTES,
  MAX_THREAD_HINT_BYTES,
} from './constants.js';
import { buildThreadHintCondensePrompt } from './prompts.js';

export type HistoryRole = 'user' | 'assistant' | 'tool' | 'system';

export interface HistoryItem {
  ordinal: number;
  role: HistoryRole;
  content: string;
  toolName?: string;
}

export interface HistoryItemPreview extends Omit<HistoryItem, 'content'> {
  windowId: string;
  truncatedContent: string;
  contentLength: number;
}

export interface WindowSummary {
  windowId: string;
  itemCount: number;
}

export interface NoteMatch {
  path: string;
  line: number;
  text: string;
}

export interface ListItemsParams {
  windowId?: string;
  role?: HistoryRole;
  limit?: number;
  recentFirst?: boolean;
}

export interface WindowState {
  windowNumber: number;
  firstWindowId: string;
  previousWindowId: string | null;
  currentWindowId: string;
}

function roleOf(message: BaseMessage): HistoryRole {
  switch (message._getType()) {
    case 'human': return 'user';
    case 'ai': return 'assistant';
    case 'tool': return 'tool';
    default: return 'system';
  }
}

function contentOf(message: BaseMessage): string {
  const base = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    return `${base}\n[tool_calls] ${JSON.stringify(toolCalls)}`;
  }
  return base;
}

export class SessionStore {
  private static instance: SessionStore | null = null;

  readonly rootDir: string;
  private readonly notesDir: string;
  private readonly historyDir: string;
  private window: WindowState;
  private readonly archivedWindowIds: string[] = [];

  tokensLeft: number | null = null;
  reminderSent = false;
  fallbackSent = false;
  newWindowRequested = false;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.notesDir = join(rootDir, 'notes');
    this.historyDir = join(rootDir, 'history');
    const id = randomUUID();
    this.window = { windowNumber: 1, firstWindowId: id, previousWindowId: null, currentWindowId: id };
  }

  static init(sessionId: string): SessionStore {
    SessionStore.instance = new SessionStore(dexterPath('sessions', sessionId));
    return SessionStore.instance;
  }

  static get(): SessionStore {
    if (!SessionStore.instance) {
      SessionStore.init(SessionStore.defaultSessionId());
    }
    return SessionStore.instance!;
  }

  static defaultSessionId(): string {
    return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  }

  // ---------------------------------------------------------------------------
  // Window state
  // ---------------------------------------------------------------------------

  get windowState(): Readonly<WindowState> {
    return this.window;
  }

  advanceWindow(): Readonly<WindowState> {
    this.window = {
      windowNumber: this.window.windowNumber + 1,
      firstWindowId: this.window.firstWindowId,
      previousWindowId: this.window.currentWindowId,
      currentWindowId: randomUUID(),
    };
    this.reminderSent = false;
    this.fallbackSent = false;
    this.newWindowRequested = false;
    return this.window;
  }

  requestNewWindow(): void {
    this.newWindowRequested = true;
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  private resolveNotePath(path: string): string {
    const parts = path.split('/');
    for (const part of parts) {
      if (part === '' || part === '.' || part === '..' || part.startsWith('~')) {
        throw new Error(`Invalid note path: ${path}`);
      }
    }
    const full = resolve(this.notesDir, ...parts);
    const rel = relative(resolve(this.notesDir), full);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new Error(`Invalid note path: ${path}`);
    }
    return full;
  }

  async writeNote(path: string, text: string): Promise<void> {
    if (Buffer.byteLength(text, 'utf8') > MAX_NOTE_BYTES) {
      throw new Error(`Note exceeds ${MAX_NOTE_BYTES} bytes`);
    }
    const full = this.resolveNotePath(path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, text, 'utf8');
  }

  async appendNote(path: string, text: string): Promise<void> {
    const full = this.resolveNotePath(path);
    let existing = 0;
    try {
      existing = (await stat(full)).size;
    } catch {
      await mkdir(join(full, '..'), { recursive: true });
    }
    if (existing + Buffer.byteLength(text, 'utf8') > MAX_NOTE_BYTES) {
      throw new Error(`Note would exceed ${MAX_NOTE_BYTES} bytes; create another file`);
    }
    await appendFile(full, text, 'utf8');
  }

  async readNote(path: string, startLine?: number, stopLine?: number): Promise<string> {
    const full = this.resolveNotePath(path);
    const text = await readFile(full, 'utf8');
    if (startLine === undefined && stopLine === undefined) return text;
    const lines = text.split('\n');
    const n = lines.length;
    const norm = (v: number | undefined, fallback: number) =>
      v === undefined ? fallback : v < 0 ? Math.max(1, n + v + 1) : Math.min(n, Math.max(1, v));
    const start = norm(startLine, 1);
    const stop = norm(stopLine, n);
    return lines.slice(start - 1, stop).join('\n');
  }

  async listNotes(prefix?: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string, rel: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(join(dir, e.name), childRel);
        else out.push(childRel);
      }
    };
    await walk(this.notesDir, '');
    out.sort();
    return prefix ? out.filter(p => p.startsWith(prefix)) : out;
  }

  async searchNotes(query: string, maxMatchesPerFile = 10): Promise<NoteMatch[]> {
    const needle = query.toLowerCase();
    const matches: NoteMatch[] = [];
    for (const path of await this.listNotes()) {
      const lines = (await this.readNote(path)).split('\n');
      let count = 0;
      for (let i = 0; i < lines.length && count < maxMatchesPerFile; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          matches.push({ path, line: i + 1, text: lines[i] });
          count++;
        }
      }
    }
    return matches;
  }

  async readAllNotes(): Promise<string> {
    const paths = await this.listNotes();
    const chunks: string[] = [];
    for (const path of paths) {
      chunks.push(`## ${path}\n${await this.readNote(path)}`);
    }
    return chunks.join('\n\n');
  }

  async buildThreadHint(model: string, signal?: AbortSignal): Promise<string | null> {
    const notes = await this.readAllNotes();
    if (!notes.trim()) return null;
    if (Buffer.byteLength(notes, 'utf8') <= MAX_THREAD_HINT_BYTES) return notes;

    const provider = resolveProvider(model);
    const { response } = await callLlm(buildThreadHintCondensePrompt(notes, MAX_THREAD_HINT_BYTES), {
      model: provider.fastModel ?? model,
      systemPrompt: 'You condense research notes without losing data.',
      signal,
    });
    const text = typeof response === 'string' ? response.trim() : String(response).trim();
    return Buffer.byteLength(text, 'utf8') <= MAX_THREAD_HINT_BYTES
      ? text
      : Buffer.from(text, 'utf8').subarray(0, MAX_THREAD_HINT_BYTES).toString('utf8');
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  private historyPath(windowId: string): string {
    return join(this.historyDir, `${windowId}.jsonl`);
  }

  async archiveWindow(windowId: string, messages: BaseMessage[]): Promise<number> {
    const items: HistoryItem[] = messages.map((m, i) => {
      const item: HistoryItem = { ordinal: i, role: roleOf(m), content: contentOf(m) };
      const name = (m as { name?: string }).name;
      if (item.role === 'tool' && name) item.toolName = name;
      return item;
    });
    await mkdir(this.historyDir, { recursive: true });
    await writeFile(this.historyPath(windowId), items.map(i => JSON.stringify(i)).join('\n') + '\n', 'utf8');
    if (!this.archivedWindowIds.includes(windowId)) this.archivedWindowIds.push(windowId);
    return items.length;
  }

  private async readWindow(windowId: string): Promise<HistoryItem[]> {
    let text: string;
    try {
      text = await readFile(this.historyPath(windowId), 'utf8');
    } catch {
      return [];
    }
    return text.split('\n').filter(Boolean).map(line => JSON.parse(line) as HistoryItem);
  }

  private async allWindowIds(): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.historyDir);
    } catch {
      return [];
    }
    const onDisk = names.filter(n => n.endsWith('.jsonl')).map(n => n.slice(0, -6));
    // Preserve archive order for this session; append any leftover from disk.
    const ordered = this.archivedWindowIds.filter(id => onDisk.includes(id));
    for (const id of onDisk) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
  }

  async listWindows(recentFirst = false, limit?: number): Promise<WindowSummary[]> {
    const ids = await this.allWindowIds();
    const out: WindowSummary[] = [];
    for (const windowId of ids) {
      out.push({ windowId, itemCount: (await this.readWindow(windowId)).length });
    }
    if (recentFirst) out.reverse();
    return limit ? out.slice(0, limit) : out;
  }

  private preview(windowId: string, item: HistoryItem): HistoryItemPreview {
    const { content, ...rest } = item;
    return {
      ...rest,
      windowId,
      truncatedContent: content.slice(0, HISTORY_PREVIEW_CHARS),
      contentLength: content.length,
    };
  }

  async listItems(params: ListItemsParams = {}): Promise<HistoryItemPreview[]> {
    const ids = params.windowId ? [params.windowId] : await this.allWindowIds();
    const out: HistoryItemPreview[] = [];
    for (const windowId of ids) {
      for (const item of await this.readWindow(windowId)) {
        if (params.role && item.role !== params.role) continue;
        out.push(this.preview(windowId, item));
      }
    }
    if (params.recentFirst) out.reverse();
    return out.slice(0, params.limit ?? DEFAULT_HISTORY_LIMIT);
  }

  async readItem(windowId: string, ordinal: number, offsetChars = 0, limitChars?: number): Promise<HistoryItem | null> {
    const items = await this.readWindow(windowId);
    const item = items.find(i => i.ordinal === ordinal);
    if (!item) return null;
    const content = limitChars === undefined
      ? item.content.slice(offsetChars)
      : item.content.slice(offsetChars, offsetChars + limitChars);
    return { ...item, content };
  }

  async searchHistory(query: string, params: ListItemsParams = {}): Promise<HistoryItemPreview[]> {
    const needle = query.toLowerCase();
    const ids = params.windowId ? [params.windowId] : await this.allWindowIds();
    const out: HistoryItemPreview[] = [];
    for (const windowId of ids) {
      for (const item of await this.readWindow(windowId)) {
        if (params.role && item.role !== params.role) continue;
        const idx = item.content.toLowerCase().indexOf(needle);
        if (idx === -1) continue;
        const start = Math.max(0, idx - Math.floor(HISTORY_PREVIEW_CHARS / 2));
        out.push({
          ...this.preview(windowId, item),
          truncatedContent: item.content.slice(start, start + HISTORY_PREVIEW_CHARS),
        });
      }
    }
    if (params.recentFirst) out.reverse();
    return out.slice(0, params.limit ?? DEFAULT_HISTORY_LIMIT);
  }
}
