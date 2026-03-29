import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  MemoryChunk,
  MemoryKeywordCandidate,
  MemorySearchResult,
  MemoryVectorCandidate,
} from './types.js';
import { buildFtsQueryExpanded } from './financial-synonyms.js';
import { extractTickers } from './ticker-extractor.js';

type SqliteQuery<T> = {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | null;
  run(...params: unknown[]): void;
};

type SqliteDatabase = {
  exec(sql: string): void;
  query<T>(sql: string): SqliteQuery<T>;
  close(): void;
  /** Available in Bun (bun:sqlite) and better-sqlite3. Used to load sqlite-vec. */
  loadExtension?: (path: string) => void;
};

type FinancialInsightRow = {
  id: number;
  ticker: string;
  exchange: string | null;
  sector: string | null;
  tags: string;
  content: string;
  content_hash: string;
  routing: string | null;
  source: string | null;
  namespace: string | null;
  created_at: number;
  updated_at: number;
  decay_weight: number;
};

type KnowledgeGraphEdgeRow = {
  id: number;
  source_id: number;
  target_id: number;
  relation: string;
  confidence: number;
  created_at: number;
};

export type FinancialInsightRecord = FinancialInsightRow;
export type KnowledgeGraphEdgeRecord = KnowledgeGraphEdgeRow;

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
  tickers: string | null;
};

type CacheRow = {
  embedding: Uint8Array;
};

const FINANCIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS financial_insights (
  id           INTEGER PRIMARY KEY,
  ticker       TEXT NOT NULL,
  exchange     TEXT,
  sector       TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  routing      TEXT,
  source       TEXT,
  namespace    TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  decay_weight REAL NOT NULL DEFAULT 1.0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fi_hash   ON financial_insights(content_hash);
CREATE INDEX        IF NOT EXISTS idx_fi_ticker ON financial_insights(ticker);

CREATE VIRTUAL TABLE IF NOT EXISTS financial_insights_fts USING fts5(
  content,
  ticker,
  tags,
  insight_id UNINDEXED
);

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES financial_insights(id),
  target_id  INTEGER NOT NULL REFERENCES financial_insights(id),
  relation   TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);
`;

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
  /** Set to true when the sqlite-vec extension was loaded successfully. */
  private vecEnabled: boolean;
  /** Embedding dimension currently used by the vec_chunks virtual table (-1 = not created). */
  private vecTableDim = -1;

  private constructor(private readonly db: SqliteDatabase, vecEnabled = false) {
    this.vecEnabled = vecEnabled;
  }

  static async create(path: string): Promise<MemoryDatabase> {
    await mkdir(dirname(path), { recursive: true });
    const db = await MemoryDatabase.openSqlite(path);

    // Attempt to load sqlite-vec for ANN vector search.
    // Falls back to JS cosine scan if unavailable.
    let vecEnabled = false;
    if (db.loadExtension) {
      try {
        const { getLoadablePath } = await import('sqlite-vec');
        db.loadExtension(getLoadablePath());
        vecEnabled = true;
      } catch {
        // sqlite-vec not installed or incompatible platform — JS fallback will be used
      }
    }

    const memoryDb = new MemoryDatabase(db, vecEnabled);
    // WAL mode: prevents database corruption on crash mid-write.
    memoryDb.db.exec('PRAGMA journal_mode=WAL');
    memoryDb.db.exec(CREATE_SCHEMA_SQL);
    memoryDb.db.exec(FINANCIAL_SCHEMA_SQL);
    memoryDb.runMigrations();
    return memoryDb;
  }

  private runMigrations(): void {
    const columns = this.db.query<{ name: string }>('PRAGMA table_info(chunks)').all();
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('source')) {
      this.db.exec("ALTER TABLE chunks ADD COLUMN source TEXT NOT NULL DEFAULT 'memory'");
    }
    if (!colNames.has('tickers')) {
      this.db.exec('ALTER TABLE chunks ADD COLUMN tickers TEXT');
    }

    // Financial insights namespace column (added in v2)
    const fiColumns = this.db.query<{ name: string }>('PRAGMA table_info(financial_insights)').all();
    const fiColNames = new Set(fiColumns.map((c) => c.name));
    if (!fiColNames.has('namespace')) {
      this.db.exec('ALTER TABLE financial_insights ADD COLUMN namespace TEXT');
    }

    // If sqlite-vec is enabled, restore vec table from persisted dimension and backfill.
    if (this.vecEnabled) {
      const dimRow = this.db.query<{ value: string }>('SELECT value FROM meta WHERE key = ?').get('embedding_dim');
      if (dimRow) {
        const dim = parseInt(dimRow.value, 10);
        if (!Number.isNaN(dim) && dim > 0) {
          const created = this.ensureVecTable(dim);
          if (created) {
            this.backfillVecTable();
          }
        }
      }
    }
  }

  /**
   * Creates the vec_chunks virtual table for the given embedding dimension.
   * Returns true if the table now exists, false on failure.
   */
  private ensureVecTable(dim: number): boolean {
    if (!this.vecEnabled) return false;
    if (this.vecTableDim === dim) return true;
    try {
      this.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[${dim}] distance_metric=cosine)`,
      );
      this.vecTableDim = dim;
      return true;
    } catch {
      // sqlite-vec unavailable at runtime despite extension load attempt
      this.vecEnabled = false;
      return false;
    }
  }

  /** Copies existing chunk embeddings into vec_chunks (idempotent — uses INSERT OR IGNORE). */
  private backfillVecTable(): void {
    const rows = this.db
      .query<{ id: number; embedding: Uint8Array | null }>('SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL')
      .all();
    for (const row of rows) {
      if (row.embedding) {
        try {
          this.db.query('INSERT OR IGNORE INTO vec_chunks (rowid, embedding) VALUES (?, ?)').run(row.id, row.embedding);
        } catch {
          // Silently skip rows that fail (e.g., dimension mismatch for old embeddings)
        }
      }
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
      loadExtension: (extPath: string) => raw.loadExtension(extPath),
    };
  }

  close(): void {
    this.db.close();
  }

  // ── Financial Insights ─────────────────────────────────────────────────────

  upsertInsight(params: {
    ticker: string;
    exchange?: string;
    sector?: string;
    tags: string;
    content: string;
    contentHash: string;
    routing?: string;
    source?: string;
    namespace?: string;
  }): number {
    const existing = this.db
      .query<{ id: number }>('SELECT id FROM financial_insights WHERE content_hash = ?')
      .get(params.contentHash);

    const now = Date.now();

    if (existing) {
      this.db
        .query(
          'UPDATE financial_insights SET ticker=?, exchange=?, sector=?, tags=?, content=?, routing=?, source=?, namespace=?, updated_at=? WHERE id=?',
        )
        .run(
          params.ticker,
          params.exchange ?? null,
          params.sector ?? null,
          params.tags,
          params.content,
          params.routing ?? null,
          params.source ?? null,
          params.namespace ?? null,
          now,
          existing.id,
        );
      this.db.query('DELETE FROM financial_insights_fts WHERE insight_id = ?').run(existing.id);
      this.db
        .query('INSERT INTO financial_insights_fts (content, ticker, tags, insight_id) VALUES (?,?,?,?)')
        .run(params.content, params.ticker, params.tags, existing.id);
      return existing.id;
    }

    this.db
      .query(
        'INSERT INTO financial_insights (ticker, exchange, sector, tags, content, content_hash, routing, source, namespace, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        params.ticker,
        params.exchange ?? null,
        params.sector ?? null,
        params.tags,
        params.content,
        params.contentHash,
        params.routing ?? null,
        params.source ?? null,
        params.namespace ?? null,
        now,
        now,
      );

    const inserted = this.db
      .query<{ id: number }>('SELECT id FROM financial_insights WHERE content_hash = ?')
      .get(params.contentHash);
    if (!inserted) throw new Error('Failed to resolve inserted financial insight id.');

    this.db
      .query('INSERT INTO financial_insights_fts (content, ticker, tags, insight_id) VALUES (?,?,?,?)')
      .run(params.content, params.ticker, params.tags, inserted.id);

    return inserted.id;
  }

  getInsightById(id: number): FinancialInsightRecord | null {
    return this.db.query<FinancialInsightRecord>('SELECT * FROM financial_insights WHERE id = ?').get(id);
  }

  searchInsightsByTicker(ticker: string): FinancialInsightRecord[] {
    return this.db
      .query<FinancialInsightRecord>(
        'SELECT * FROM financial_insights WHERE UPPER(ticker) = UPPER(?) ORDER BY updated_at DESC',
      )
      .all(ticker);
  }

  searchInsightsFts(query: string, maxResults: number): FinancialInsightRecord[] {
    const sanitized = buildFtsQuery(query);
    if (!sanitized) return [];
    const rows = this.db
      .query<{ insight_id: number; rank: number }>(
        'SELECT insight_id, bm25(financial_insights_fts) AS rank FROM financial_insights_fts WHERE financial_insights_fts MATCH ? ORDER BY rank LIMIT ?',
      )
      .all(sanitized, maxResults);
    const ids = rows.map((r) => r.insight_id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db
      .query<FinancialInsightRecord>(`SELECT * FROM financial_insights WHERE id IN (${placeholders})`)
      .all(...ids);
  }

  loadRecentInsights(limit: number): FinancialInsightRecord[] {
    return this.db
      .query<FinancialInsightRecord>('SELECT * FROM financial_insights ORDER BY updated_at DESC LIMIT ?')
      .all(limit);
  }

  // ── Knowledge Graph ─────────────────────────────────────────────────────────

  addEdge(sourceId: number, targetId: number, relation: string, confidence = 1.0): void {
    this.db
      .query(
        'INSERT INTO knowledge_graph_edges (source_id, target_id, relation, confidence, created_at) VALUES (?,?,?,?,?)',
      )
      .run(sourceId, targetId, relation, confidence, Date.now());
  }

  getEdgesForInsight(insightId: number): KnowledgeGraphEdgeRecord[] {
    return this.db
      .query<KnowledgeGraphEdgeRecord>(
        'SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ? ORDER BY created_at DESC',
      )
      .all(insightId, insightId);
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
    const tickers = extractTickers(params.chunk.content).join(',') || null;

    if (existing) {
      // Skip the write entirely when nothing has changed — avoids touching index.sqlite
      // mtime and prevents the file watcher from firing unnecessarily.
      const filePath = params.chunk.filePath;
      const startLine = params.chunk.startLine;
      const endLine = params.chunk.endLine;
      const content = params.chunk.content;
      const existingTickers = extractTickers((existing as { content: string }).content).join(',') || null;
      const hasExistingEmbedding = (existing as { embedding: unknown }).embedding != null;
      if (
        (existing as { file_path: string }).file_path === filePath &&
        (existing as { start_line: number }).start_line === startLine &&
        (existing as { end_line: number }).end_line === endLine &&
        (existing as { content: string }).content === content &&
        (existing as { source?: string }).source === source &&
        existingTickers === tickers &&
        hasExistingEmbedding === (embeddingBlob != null)
      ) {
        return { id: existing.id, inserted: false };
      }
      this.db
        .query(
          'UPDATE chunks SET file_path = ?, start_line = ?, end_line = ?, content = ?, embedding = ?, embedding_provider = ?, embedding_model = ?, updated_at = ?, source = ?, tickers = ? WHERE id = ?',
        )
        .run(
          filePath,
          startLine,
          endLine,
          content,
          embeddingBlob,
          params.provider ?? null,
          params.model ?? null,
          Date.now(),
          source,
          tickers,
          existing.id,
        );
      this.db.query('DELETE FROM chunks_fts WHERE chunk_id = ?').run(existing.id);
      this.db.query('INSERT INTO chunks_fts (content, chunk_id) VALUES (?, ?)').run(content, existing.id);

      if (embeddingBlob && params.embedding) {
        this.upsertVecChunk(existing.id, embeddingBlob, params.embedding.length);
      }
      return { id: existing.id, inserted: false };
    }

    this.db
      .query(
        'INSERT INTO chunks (file_path, start_line, end_line, content, content_hash, embedding, embedding_provider, embedding_model, updated_at, source, tickers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        tickers,
      );

    const inserted = this.db.query<{ id: number }>('SELECT id FROM chunks WHERE content_hash = ?').get(
      params.chunk.contentHash,
    );
    if (!inserted) {
      throw new Error('Failed to resolve inserted chunk id.');
    }
    this.db.query('INSERT INTO chunks_fts (content, chunk_id) VALUES (?, ?)').run(params.chunk.content, inserted.id);

    if (embeddingBlob && params.embedding) {
      this.upsertVecChunk(inserted.id, embeddingBlob, params.embedding.length);
    }
    return { id: inserted.id, inserted: true };
  }

  /** Ensures the vec_chunks table exists for `dim` dimensions and inserts/replaces the vector. */
  private upsertVecChunk(chunkId: number, embeddingBlob: Uint8Array, dim: number): void {
    if (!this.ensureVecTable(dim)) return;
    // Persist dimension to meta so it survives process restarts.
    if (this.vecTableDim === dim) {
      this.db.query("INSERT OR IGNORE INTO meta (key, value) VALUES ('embedding_dim', ?)").run(String(dim));
    }
    try {
      this.db.query('INSERT OR REPLACE INTO vec_chunks (rowid, embedding) VALUES (?, ?)').run(chunkId, embeddingBlob);
    } catch {
      // Dimension mismatch or other vec error — skip silently
    }
  }

  deleteChunksForFile(filePath: string): number {
    const rows = this.db.query<{ id: number }>('SELECT id FROM chunks WHERE file_path = ?').all(filePath);
    for (const row of rows) {
      this.db.query('DELETE FROM chunks_fts WHERE chunk_id = ?').run(row.id);
      if (this.vecEnabled && this.vecTableDim > 0) {
        try {
          this.db.query('DELETE FROM vec_chunks WHERE rowid = ?').run(row.id);
        } catch { /* ignore if table not yet created */ }
      }
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

  /**
   * KNN vector search using sqlite-vec if loaded; falls back to O(n) JS cosine scan.
   * Scores are in [0, 1]: 1 = identical, 0 = orthogonal/opposite.
   */
  searchVector(queryEmbedding: number[], maxResults: number): MemoryVectorCandidate[] {
    if (this.vecEnabled && this.vecTableDim === queryEmbedding.length) {
      try {
        return this.searchVectorKnn(queryEmbedding, maxResults);
      } catch {
        // Unexpected error from vec extension — fall through to JS scan
      }
    }
    return this.searchVectorScan(queryEmbedding, maxResults);
  }

  private searchVectorKnn(queryEmbedding: number[], maxResults: number): MemoryVectorCandidate[] {
    const queryBlob = toBlob(queryEmbedding);
    const rows = this.db
      .query<{ rowid: number; distance: number }>(
        'SELECT rowid, distance FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance LIMIT ?',
      )
      .all(queryBlob, maxResults);
    // sqlite-vec cosine distance: 0 = identical, 2 = opposite. Convert to similarity score.
    return rows.map((row) => ({
      chunkId: row.rowid,
      score: Math.max(0, 1 - row.distance / 2),
    }));
  }

  private searchVectorScan(queryEmbedding: number[], maxResults: number): MemoryVectorCandidate[] {
    const rows = this.db
      .query<{ id: number; embedding: Uint8Array | null }>(
        'SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL',
      )
      .all();
    return rows
      .map((row) => {
        if (!row.embedding) return null;
        return { chunkId: row.id, score: cosineSimilarity(queryEmbedding, fromBlob(row.embedding)) };
      })
      .filter((entry): entry is MemoryVectorCandidate => Boolean(entry))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  searchKeyword(query: string, maxResults: number): MemoryKeywordCandidate[] {
    const ftsQuery = buildFtsQueryExpanded(query);
    if (!ftsQuery) {
      return [];
    }
    // Fetch extra candidates so min-max normalisation is representative.
    const fetchCount = Math.max(maxResults * 2, 20);
    const rows = this.db
      .query<{ chunk_id: number; rank: number }>(
        // k1=1.5 (term-freq saturation), b=0.75 (field-length norm) — tuned for
        // financial text with frequent proper nouns and ticker symbols.
        'SELECT chunk_id, bm25(chunks_fts, 1.5, 0.75) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?',
      )
      .all(ftsQuery, fetchCount);

    if (rows.length === 0) return [];

    // SQLite BM25 returns negative values — more negative = better match.
    // Normalise to [0, 1]: best candidate → 1, worst → 0.
    const minRank = Math.min(...rows.map((r) => r.rank));
    const maxRank = Math.max(...rows.map((r) => r.rank));
    const range = maxRank - minRank;

    return rows.slice(0, maxResults).map((row) => ({
      chunkId: row.chunk_id,
      score: range > 0 ? (maxRank - row.rank) / range : 1,
    }));
  }

  /**
   * Returns tickers stored for the given chunk IDs.
   * Used by hybridSearch to boost score for ticker-matching results.
   */
  getChunkTickers(ids: number[]): Map<number, string[]> {
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .query<{ id: number; tickers: string | null }>(
        `SELECT id, tickers FROM chunks WHERE id IN (${placeholders})`,
      )
      .all(...ids);
    const result = new Map<number, string[]>();
    for (const row of rows) {
      result.set(row.id, row.tickers ? row.tickers.split(',') : []);
    }
    return result;
  }

  loadResultsByIds(ids: number[]): MemorySearchResult[] {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .query<ChunkRow>(
        `SELECT id, file_path, start_line, end_line, content, content_hash, embedding, source, updated_at, tickers FROM chunks WHERE id IN (${placeholders})`,
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
        tickers: row.tickers ? row.tickers.split(',') : [],
      }));
  }

  /** Expose whether sqlite-vec ANN index is active (used in tests and diagnostics). */
  get isVecEnabled(): boolean {
    return this.vecEnabled && this.vecTableDim > 0;
  }
}
