import { MemoryDatabase } from './database.js';
import { createEmbeddingClient } from './embeddings.js';
import { MemoryIndexer } from './indexer.js';
import { hybridSearch } from './search.js';
import { MemoryStore } from './store.js';
import type {
  MemoryReadOptions,
  MemoryReadResult,
  MemoryRuntimeConfig,
  MemorySearchOptions,
  MemorySearchResult,
  MemorySessionContext,
  TemporalDecayConfig,
  MMRConfig,
} from './types.js';
import { getSetting } from '../utils/config.js';

const DEFAULT_CONFIG: MemoryRuntimeConfig = {
  enabled: true,
  embeddingProvider: 'auto',
  embeddingModel: undefined,
  maxSessionContextTokens: 2000,
  chunkTokens: 400,
  chunkOverlapTokens: 80,
  maxResults: 6,
  minScore: 0.1,
  vectorWeight: 0.7,
  textWeight: 0.3,
  watchDebounceMs: 1500,
  temporalDecay: { enabled: true, halfLifeDays: 30 },
  mmr: { enabled: true, lambda: 0.7 },
  indexSessions: true,
};

type MemorySettings = {
  enabled?: boolean;
  embeddingProvider?: MemoryRuntimeConfig['embeddingProvider'];
  embeddingModel?: string;
  maxSessionContextTokens?: number;
  temporalDecay?: Partial<TemporalDecayConfig>;
  mmr?: Partial<MMRConfig>;
  indexSessions?: boolean;
};

function resolveConfig(): MemoryRuntimeConfig {
  const settings = getSetting<MemorySettings | undefined>('memory', undefined);
  return {
    ...DEFAULT_CONFIG,
    ...(settings ?? {}),
    temporalDecay: { ...DEFAULT_CONFIG.temporalDecay, ...(settings?.temporalDecay ?? {}) },
    mmr: { ...DEFAULT_CONFIG.mmr, ...(settings?.mmr ?? {}) },
  };
}

export class MemoryManager {
  private static instance: MemoryManager | null = null;

  static async get(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      const instance = new MemoryManager(resolveConfig());
      await instance.initialize();
      MemoryManager.instance = instance;
    }
    return MemoryManager.instance;
  }

  private readonly store = new MemoryStore();
  private db: MemoryDatabase | null = null;
  private indexer: MemoryIndexer | null = null;
  private initError: string | null = null;

  private constructor(private readonly config: MemoryRuntimeConfig) {}

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    if (this.db) {
      return;
    }

    await this.store.ensureDirectoryExists();
    const client = createEmbeddingClient({
      provider: this.config.embeddingProvider,
      model: this.config.embeddingModel,
    });

    try {
      this.db = await MemoryDatabase.create(`${this.store.getMemoryDir()}/index.sqlite`);
      const fingerprint = client ? `${client.provider}:${client.model}` : 'none:none';
      if (this.db.getProviderFingerprint() !== fingerprint) {
        this.db.clearEmbeddings();
        this.db.setProviderFingerprint(fingerprint);
      }

      this.indexer = new MemoryIndexer(this.store, this.db, {
        chunkTokens: this.config.chunkTokens,
        overlapTokens: this.config.chunkOverlapTokens,
        watchDebounceMs: this.config.watchDebounceMs,
        embeddingClient: client,
        indexSessions: this.config.indexSessions,
      });
      this.indexer.startWatching();
      await this.indexer.sync({ force: false });
    } catch (error) {
      this.initError = error instanceof Error ? error.message : String(error);
      this.db = null;
      this.indexer = null;
    }
  }

  isAvailable(): boolean {
    return this.config.enabled && Boolean(this.db);
  }

  getUnavailableReason(): string | null {
    if (!this.config.enabled) {
      return 'Memory is disabled in settings.';
    }
    return this.initError;
  }

  async sync(options?: { force?: boolean }): Promise<void> {
    await this.initialize();
    if (!this.indexer) {
      return;
    }
    await this.indexer.sync(options);
  }

  async search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]> {
    await this.initialize();
    if (!this.db || !this.indexer) {
      return [];
    }
    if (this.indexer.isDirty()) {
      await this.indexer.sync();
    }

    const client = createEmbeddingClient({
      provider: this.config.embeddingProvider,
      model: this.config.embeddingModel,
    });
    return hybridSearch({
      db: this.db,
      embeddingClient: client,
      query,
      options,
      defaults: {
        maxResults: this.config.maxResults,
        minScore: this.config.minScore,
        vectorWeight: this.config.vectorWeight,
        textWeight: this.config.textWeight,
      },
      temporalDecay: this.config.temporalDecay,
      mmr: this.config.mmr,
    });
  }

  async get(options: MemoryReadOptions): Promise<MemoryReadResult> {
    await this.initialize();
    return this.store.readLines(options);
  }

  async appendLongTermMemory(text: string): Promise<void> {
    await this.initialize();
    await this.store.appendMemoryFile('MEMORY.md', text);
    this.indexer?.markDirty();
  }

  async appendDailyMemory(text: string): Promise<void> {
    await this.initialize();
    await this.store.appendMemoryFile(this.getTodayFileName(), text);
    this.indexer?.markDirty();
  }

  async editMemory(file: string, oldText: string, newText: string): Promise<boolean> {
    await this.initialize();
    const resolved = this.resolveFileAlias(file);
    const result = await this.store.editInMemoryFile(resolved, oldText, newText);
    if (result) {
      this.indexer?.markDirty();
    }
    return result;
  }

  async deleteMemory(file: string, textToDelete: string): Promise<boolean> {
    await this.initialize();
    const resolved = this.resolveFileAlias(file);
    const result = await this.store.deleteFromMemoryFile(resolved, textToDelete);
    if (result) {
      this.indexer?.markDirty();
    }
    return result;
  }

  async appendMemory(file: string, content: string): Promise<void> {
    await this.initialize();
    const resolved = this.resolveFileAlias(file);
    await this.store.appendMemoryFile(resolved, content);
    this.indexer?.markDirty();
  }

  async listFiles(): Promise<string[]> {
    await this.initialize();
    return this.store.listMemoryFiles();
  }

  async loadSessionContext(): Promise<MemorySessionContext> {
    await this.initialize();
    return this.store.loadSessionContext(this.config.maxSessionContextTokens);
  }

  private resolveFileAlias(file: string): string {
    if (file === 'long_term') return 'MEMORY.md';
    if (file === 'daily') return this.getTodayFileName();
    return file;
  }

  private getTodayFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}.md`;
  }
}
