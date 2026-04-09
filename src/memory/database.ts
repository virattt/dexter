import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  MemoryChunk,
  MemoryKeywordCandidate,
  MemorySearchResult,
  MemoryVectorCandidate,
} from './types.js';

type SqliteQuery<T> = {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | null;
  run(...params: unknown[]): void;
};

type SqliteDatabase = {
  exec(sql: string): void;
  query<T>(sql: string): SqliteQuery<T>;
  close(): void;
};

type ChunkRow = {
  id: number;
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  content_hash: string;
  embedding: Uint8Array | null;
  source: string;
  updated_at: number;
};

type CacheRow = {
  embedding: Uint8Array;
};

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding BLOB,
  embedding_provider TEXT,
  embedding_model TEXT,
  updated_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'memory'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON chunks(file_path);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  chunk_id UNINDEXED
);

CREATE TABLE IF NOT EXISTS embedding_cache (
  content_hash TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function toBlob(vector: number[]): Uint8Array {
  const floatArray = new Float32Array(vector);
  return new Uint8Array(floatArray.buffer);
}

function fromBlob(blob: Uint8Array): number[] {
  const buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
  return Array.from(new Float32Array(buffer));
}

// Build an FTS5 AND query with quoted, Unicode-aware tokens for precise matching.
// Vector search already provides broad recall; keyword search should be precise.
function buildFtsQuery(raw: string): string {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) return '';
  const quoted = tokens.map((t) => `"${t.replaceAll('"', '')}"`);
  return quoted.join(' AND ');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class MemoryDatabase {
  private constructor(private readonly db: SqliteDatabase) {}

  static async create(path: string): Promise<MemoryDatabase> {
    await mkdir(dirname(path), { recursive: true });
    const db = await MemoryDatabase.openSqlite(path);
    const memoryDb = new MemoryDatabase(db);
    memoryDb.db.exec(CREATE_SCHEMA_SQL);
    memoryDb.runMigrations();
    return memoryDb;
  }

  private runMigrations(): void {
    const columns = this.db.query<{ name: string }>('PRAGMA table_info(chunks)').all();
    if (!columns.some((c) => c.name === 'source')) {
      this.db.exec("ALTER TABLE chunks ADD COLUMN source TEXT NOT NULL DEFAULT 'memory'");
    }
  }

  private static async openSqlite(path: string): Promise<SqliteDatabase> {
    // Prefer bun:sqlite when running under Bun; fall back to better-sqlite3 for Node.js
    try {
      const sqlite = await import('bun:sqlite');
      const DatabaseCtor = sqlite.Database as new (dbPath: string) => SqliteDatabase;
      return new DatabaseCtor(path);
    } catch {
      return MemoryDatabase.openBetterSqlite3(path);
    }
  }

  private static async openBetterSqlite3(path: string): Promise<SqliteDatabase> {
    const mod = await import('better-sqlite3');
    const Database = mod.default;
    const raw = new Database(path);

    return {
      exec: (sql: string) => raw.exec(sql),
      query: <T>(sql: string): SqliteQuery<T> => {
        const stmt = raw.prepare(sql);
        return {
          all: (...params: unknown[]) => stmt.all(...params) as T[],
          get: (...params: unknown[]) => (stmt.get(...params) as T) ?? null,
          run: (...params: unknown[]) => { stmt.run(...params); },
        };
      },
      close: () => raw.close(),
    };
  }

  close(): void {
    this.db.close();
  }

  getProviderFingerprint(): string | null {
    const row = this.db
      .query<{ value: string }>('SELECT value FROM meta WHERE key = ?')
      .get('provider_fingerprint');
    return row?.value ?? null;
  }

  setProviderFingerprint(value: string): void {
    this.db
      .query('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('provider_fingerprint', value);
  }

  clearEmbeddings(): void {
    this.db.query('UPDATE chunks SET embedding = NULL, embedding_provider = NULL, embedding_model = NULL').run();
    this.db.query('DELETE FROM embedding_cache').run();
  }

  getCachedEmbedding(contentHash: string): number[] | null {
    const row = this.db
      .query<CacheRow>('SELECT embedding FROM embedding_cache WHERE content_hash = ?')
      .get(contentHash);
    if (!row) {
      return null;
    }
    return fromBlob(row.embedding);
  }

  setCachedEmbedding(params: {
    contentHash: string;
    embedding: number[];
    provider: string;
    model: string;
  }): void {
    this.db
      .query(
        'INSERT OR REPLACE INTO embedding_cache (content_hash, embedding, provider, model, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(params.contentHash, toBlob(params.embedding), params.provider, params.model, Date.now());
  }

  getChunkByHash(contentHash: string): ChunkRow | null {
    return this.db
      .query<ChunkRow>(
        'SELECT id, file_path, start_line, end_line, content, content_hash, embedding FROM chunks WHERE content_hash = ?',
      )
      .get(contentHash);
  }

  upsertChunk(params: {
    chunk: MemoryChunk;
    embedding: number[] | null;
    provider?: string;
    model?: string;
    source?: string;
  }): { id: number; inserted: boolean } {
    const existing = this.getChunkByHash(params.chunk.contentHash);
    const embeddingBlob = params.embedding ? toBlob(params.embedding) : null;
    const source = params.source ?? params.chunk.source ?? 'memory';
    if (existing) {
      this.db
        .query(
          'UPDATE chunks SET file_path = ?, start_line = ?, end_line = ?, content = ?, embedding = ?, embedding_provider = ?, embedding_model = ?, updated_at = ?, source = ? WHERE id = ?',
        )
        .run(
          params.chunk.filePath,
          params.chunk.startLine,
          params.chunk.endLine,
          params.chunk.content,
          embeddingBlob,
          params.provider ?? null,
          params.model ?? null,
          Date.now(),
          source,
          existing.id,
        );
      this.db.query('DELETE FROM chunks_fts WHERE chunk_id = ?').run(existing.id);
      this.db.query('INSERT INTO chunks_fts (content, chunk_id) VALUES (?, ?)').run(params.chunk.content, existing.id);
      return { id: existing.id, inserted: false };
    }

    this.db
      .query(
        'INSERT INTO chunks (file_path, start_line, end_line, content, content_hash, embedding, embedding_provider, embedding_model, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        params.chunk.filePath,
        params.chunk.startLine,
        params.chunk.endLine,
        params.chunk.content,
        params.chunk.contentHash,
        embeddingBlob,
        params.provider ?? null,
        params.model ?? null,
        Date.now(),
        source,
      );

    const inserted = this.db.query<{ id: number }>('SELECT id FROM chunks WHERE content_hash = ?').get(
      params.chunk.contentHash,
    );
    if (!inserted) {
      throw new Error('Failed to resolve inserted chunk id.');
    }
    this.db.query('INSERT INTO chunks_fts (content, chunk_id) VALUES (?, ?)').run(params.chunk.content, inserted.id);
    return { id: inserted.id, inserted: true };
  }

  deleteChunksForFile(filePath: string): number {
    const rows = this.db.query<{ id: number }>('SELECT id FROM chunks WHERE file_path = ?').all(filePath);
    for (const row of rows) {
      this.db.query('DELETE FROM chunks_fts WHERE chunk_id = ?').run(row.id);
    }
    this.db.query('DELETE FROM chunks WHERE file_path = ?').run(filePath);
    return rows.length;
  }

  listIndexedFiles(): string[] {
    const rows = this.db.query<{ file_path: string }>('SELECT DISTINCT file_path FROM chunks').all();
    return rows.map((row) => row.file_path);
  }

  listAllChunks(): ChunkRow[] {
    return this.db
      .query<ChunkRow>(
        'SELECT id, file_path, start_line, end_line, content, content_hash, embedding FROM chunks ORDER BY id ASC',
      )
      .all();
  }

  searchVector(queryEmbedding: number[], maxResults: number): MemoryVectorCandidate[] {
    const rows = this.db
      .query<{ id: number; embedding: Uint8Array | null }>(
        'SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL',
      )
      .all();
    const scored = rows
      .map((row) => {
        if (!row.embedding) {
          return null;
        }
        const score = cosineSimilarity(queryEmbedding, fromBlob(row.embedding));
        return { chunkId: row.id, score };
      })
      .filter((entry): entry is MemoryVectorCandidate => Boolean(entry))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    return scored;
  }

  searchKeyword(query: string, maxResults: number): MemoryKeywordCandidate[] {
    const sanitized = buildFtsQuery(query);
    if (!sanitized) {
      return [];
    }
    const rows = this.db
      .query<{ chunk_id: number; rank: number }>(
        'SELECT chunk_id, bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?',
      )
      .all(sanitized, maxResults);
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      score: 1 / (1 + Math.max(0, row.rank)),
    }));
  }

  loadResultsByIds(ids: number[]): MemorySearchResult[] {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .query<ChunkRow>(
        `SELECT id, file_path, start_line, end_line, content, content_hash, embedding, source, updated_at FROM chunks WHERE id IN (${placeholders})`,
      )
      .all(...ids);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => rowById.get(id))
      .filter((row): row is ChunkRow => Boolean(row))
      .map((row) => ({
        snippet: row.content,
        path: row.file_path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: 0,
        source: 'keyword' as const,
        contentSource: (row.source ?? 'memory') as 'memory' | 'sessions',
        updatedAt: row.updated_at,
      }));
  }
}
