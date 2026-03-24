import { watch, type FSWatcher } from 'node:fs';
import type { MemoryDatabase } from './database.js';
import { chunkMemoryText } from './chunker.js';
import type { MemoryEmbeddingClient, MemorySyncStats } from './types.js';
import { MemoryStore } from './store.js';

export class MemoryIndexer {
  private watcher: FSWatcher | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private syncing: Promise<MemorySyncStats> | null = null;
  private dirty = true;

  constructor(
    private readonly store: MemoryStore,
    private readonly db: MemoryDatabase,
    private readonly options: {
      chunkTokens: number;
      overlapTokens: number;
      watchDebounceMs: number;
      embeddingClient: MemoryEmbeddingClient | null;
    },
  ) {}

  markDirty(): void {
    this.dirty = true;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  startWatching(): void {
    if (this.watcher) {
      return;
    }
    this.watcher = watch(this.store.getMemoryDir(), { recursive: false }, () => {
      this.markDirty();
      if (this.watchTimer) {
        clearTimeout(this.watchTimer);
      }
      this.watchTimer = setTimeout(() => {
        void this.sync().catch(() => {});
      }, this.options.watchDebounceMs);
    });
  }

  stopWatching(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
    this.watcher?.close();
    this.watcher = null;
  }

  async sync(options?: { force?: boolean }): Promise<MemorySyncStats> {
    if (!options?.force && !this.dirty) {
      return {
        indexedFiles: 0,
        indexedChunks: 0,
        updatedChunks: 0,
        removedChunks: 0,
      };
    }
    if (this.syncing) {
      return this.syncing;
    }
    this.syncing = this.performSync(options).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async performSync(options?: { force?: boolean }): Promise<MemorySyncStats> {
    await this.store.ensureDirectoryExists();

    const files = await this.store.listMemoryFiles();
    const indexedFilesBefore = new Set(this.db.listIndexedFiles());
    let removedChunks = 0;
    for (const knownFile of indexedFilesBefore) {
      if (!files.includes(knownFile)) {
        removedChunks += this.db.deleteChunksForFile(knownFile);
      }
    }

    let indexedChunks = 0;
    let updatedChunks = 0;

    for (const file of files) {
      const text = await this.store.readMemoryFile(file);
      const chunks = chunkMemoryText({
        filePath: file,
        text,
        chunkTokens: this.options.chunkTokens,
        overlapTokens: this.options.overlapTokens,
      });

      if (options?.force) {
        removedChunks += this.db.deleteChunksForFile(file);
      }

      const uncached = chunks.filter((chunk) => !this.db.getCachedEmbedding(chunk.contentHash));
      let uncachedVectors: number[][] = [];
      if (uncached.length > 0 && this.options.embeddingClient) {
        uncachedVectors = await this.options.embeddingClient.embed(uncached.map((chunk) => chunk.content));
      }

      const uncachedMap = new Map<string, number[]>();
      for (let i = 0; i < uncached.length; i += 1) {
        const chunk = uncached[i];
        const vector = uncachedVectors[i];
        if (!chunk || !vector) {
          continue;
        }
        uncachedMap.set(chunk.contentHash, vector);
        this.db.setCachedEmbedding({
          contentHash: chunk.contentHash,
          embedding: vector,
          provider: this.options.embeddingClient?.provider ?? 'none',
          model: this.options.embeddingClient?.model ?? 'none',
        });
      }

      for (const chunk of chunks) {
        const cached = this.db.getCachedEmbedding(chunk.contentHash);
        const embedding = cached ?? uncachedMap.get(chunk.contentHash) ?? null;
        const result = this.db.upsertChunk({
          chunk,
          embedding,
          provider: this.options.embeddingClient?.provider,
          model: this.options.embeddingClient?.model,
        });
        indexedChunks += 1;
        if (!result.inserted) {
          updatedChunks += 1;
        }
      }

      // Ensure removed files do not linger if a file was truncated to empty.
      if (chunks.length === 0) {
        removedChunks += this.db.deleteChunksForFile(file);
      }
    }

    this.dirty = false;
    return {
      indexedFiles: files.length,
      indexedChunks,
      updatedChunks,
      removedChunks,
    };
  }
}
