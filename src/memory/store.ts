import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import type { MemoryReadOptions, MemoryReadResult, MemorySessionContext } from './types.js';
import { estimateTokens } from '../utils/tokens.js';
import { getDexterDir } from '../utils/paths.js';

const MEMORY_DIRNAME = 'memory';
const LONG_TERM_FILE = 'MEMORY.md';
const DAILY_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDailyFileName(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.md`;
}

export class MemoryStore {
  constructor(private readonly baseDir: string = getDexterDir()) {}

  getMemoryDir(): string {
    return join(this.baseDir, MEMORY_DIRNAME);
  }

  getChatHistoryPath(): string {
    return join(this.baseDir, 'messages', 'chat_history.json');
  }

  getLongTermMemoryPath(): string {
    return join(this.getMemoryDir(), LONG_TERM_FILE);
  }

  getDailyMemoryPath(date: Date = new Date()): string {
    return join(this.getMemoryDir(), formatDailyFileName(date));
  }

  async ensureDirectoryExists(): Promise<void> {
    await mkdir(this.getMemoryDir(), { recursive: true });
  }

  async readMemoryFile(path: string): Promise<string> {
    const resolved = this.resolveMemoryPath(path);
    try {
      return await readFile(resolved, 'utf-8');
    } catch {
      return '';
    }
  }

  async writeMemoryFile(path: string, content: string): Promise<void> {
    const resolved = this.resolveMemoryPath(path);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, content, 'utf-8');
  }

  async appendMemoryFile(path: string, content: string): Promise<void> {
    const previous = await this.readMemoryFile(path);
    const separator = previous.endsWith('\n') || previous.length === 0 ? '' : '\n';
    await this.writeMemoryFile(path, `${previous}${separator}${content}`);
  }

  async editInMemoryFile(path: string, oldText: string, newText: string): Promise<boolean> {
    const content = await this.readMemoryFile(path);
    if (!content.includes(oldText)) {
      return false;
    }
    const updated = content.replace(oldText, newText);
    await this.writeMemoryFile(path, updated);
    return true;
  }

  async deleteFromMemoryFile(path: string, textToDelete: string): Promise<boolean> {
    const content = await this.readMemoryFile(path);
    if (!content.includes(textToDelete)) {
      return false;
    }
    const updated = content.replace(textToDelete, '').replace(/\n{3,}/g, '\n\n');
    await this.writeMemoryFile(path, updated);
    return true;
  }

  async listMemoryFiles(): Promise<string[]> {
    await this.ensureDirectoryExists();
    const entries = await readdir(this.getMemoryDir(), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name === LONG_TERM_FILE || DAILY_FILE_RE.test(name))
      .sort();
  }

  async readLines(options: MemoryReadOptions): Promise<MemoryReadResult> {
    const path = options.path.trim();
    const text = await this.readMemoryFile(path);
    if (!text) {
      return { path, text: '' };
    }

    const lines = text.split('\n');
    const start = options.from ? Math.max(1, options.from) : 1;
    const startIndex = start - 1;
    const endIndex =
      options.lines && options.lines > 0 ? Math.min(startIndex + options.lines, lines.length) : lines.length;
    const sliced = lines.slice(startIndex, endIndex).join('\n');
    return { path, text: sliced };
  }

  async loadSessionContext(maxTokens: number): Promise<MemorySessionContext> {
    const filesLoaded: string[] = [];
    const sections: string[] = [];
    const candidates = [LONG_TERM_FILE, formatDailyFileName(), formatDailyFileName(new Date(Date.now() - 86_400_000))];

    let tokenEstimate = 0;
    for (const file of candidates) {
      const content = (await this.readMemoryFile(file)).trim();
      if (!content) {
        continue;
      }

      const nextSection = `### ${file}\n${content}`;
      const nextTokens = estimateTokens(nextSection);
      if (tokenEstimate + nextTokens > maxTokens) {
        continue;
      }

      tokenEstimate += nextTokens;
      filesLoaded.push(file);
      sections.push(nextSection);
    }

    return {
      filesLoaded,
      tokenEstimate,
      text: sections.join('\n\n'),
    };
  }

  resolveMemoryPath(path: string): string {
    const memoryDir = this.getMemoryDir();
    const normalized = normalize(path);
    const candidate = normalized.startsWith('/') ? normalized : join(memoryDir, normalized);
    const rel = relative(memoryDir, candidate);
    if (rel.startsWith('..') || rel.includes('/../') || rel === '..') {
      throw new Error(`Path is outside memory directory: ${path}`);
    }
    return candidate;
  }
}
