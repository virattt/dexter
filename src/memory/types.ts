export type EmbeddingProviderId = 'openai' | 'gemini' | 'ollama' | 'auto' | 'none';

export interface MemoryRuntimeConfig {
  enabled: boolean;
  embeddingProvider: EmbeddingProviderId;
  embeddingModel?: string;
  maxSessionContextTokens: number;
  chunkTokens: number;
  chunkOverlapTokens: number;
  maxResults: number;
  minScore: number;
  vectorWeight: number;
  textWeight: number;
  watchDebounceMs: number;
}

export interface MemoryChunk {
  id?: number;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  contentHash: string;
}

export interface MemoryVectorCandidate {
  chunkId: number;
  score: number;
}

export interface MemoryKeywordCandidate {
  chunkId: number;
  score: number;
}

export interface MemorySearchResult {
  snippet: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  source: 'vector' | 'keyword' | 'both';
}

export interface MemorySearchOptions {
  maxResults?: number;
  minScore?: number;
}

export interface MemoryReadOptions {
  path: string;
  from?: number;
  lines?: number;
}

export interface MemoryReadResult {
  path: string;
  text: string;
}

export interface MemorySessionContext {
  filesLoaded: string[];
  text: string;
  tokenEstimate: number;
}

export interface MemorySyncStats {
  indexedFiles: number;
  indexedChunks: number;
  updatedChunks: number;
  removedChunks: number;
}

export interface MemoryEmbeddingClient {
  provider: Exclude<EmbeddingProviderId, 'auto' | 'none'>;
  model: string;
  dimensions?: number;
  embed(texts: string[]): Promise<number[][]>;
}
