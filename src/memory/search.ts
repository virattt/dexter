import { buildSnippet } from './chunker.js';
import { embedSingleQuery } from './embeddings.js';
import { applyTemporalDecay } from './temporal-decay.js';
import { applyMMRToHybridResults } from './mmr.js';
import type { MemoryDatabase } from './database.js';
import type {
  MemoryEmbeddingClient,
  MemorySearchOptions,
  MemorySearchResult,
  TemporalDecayConfig,
  MMRConfig,
} from './types.js';

type CombinedScore = {
  id: number;
  vectorScore: number;
  keywordScore: number;
};

function normalizeWeights(vectorWeight: number, textWeight: number): { vector: number; text: number } {
  const sum = vectorWeight + textWeight;
  if (sum <= 0) {
    return { vector: 0.7, text: 0.3 };
  }
  return {
    vector: vectorWeight / sum,
    text: textWeight / sum,
  };
}

export async function hybridSearch(params: {
  db: MemoryDatabase;
  embeddingClient: MemoryEmbeddingClient | null;
  query: string;
  options?: MemorySearchOptions;
  defaults: {
    maxResults: number;
    minScore: number;
    vectorWeight: number;
    textWeight: number;
  };
  temporalDecay?: TemporalDecayConfig;
  mmr?: MMRConfig;
}): Promise<MemorySearchResult[]> {
  const maxResults = Math.max(1, params.options?.maxResults ?? params.defaults.maxResults);
  const minScore = params.options?.minScore ?? params.defaults.minScore;
  const candidateCount = maxResults * 4;

  const queryEmbedding = await embedSingleQuery(params.embeddingClient, params.query);
  const vectorCandidates = queryEmbedding ? params.db.searchVector(queryEmbedding, candidateCount) : [];
  const keywordCandidates = params.db.searchKeyword(params.query, candidateCount);

  // When a search path is unavailable (no embedding client → no vector results),
  // give full weight to the path that did run so scores aren't artificially suppressed.
  const hasVector = vectorCandidates.length > 0;
  const hasKeyword = keywordCandidates.length > 0;
  const weights =
    hasVector && hasKeyword
      ? normalizeWeights(params.defaults.vectorWeight, params.defaults.textWeight)
      : hasVector
        ? { vector: 1, text: 0 }
        : { vector: 0, text: 1 };

  const scoreMap = new Map<number, CombinedScore>();
  for (const candidate of vectorCandidates) {
    scoreMap.set(candidate.chunkId, {
      id: candidate.chunkId,
      vectorScore: candidate.score,
      keywordScore: 0,
    });
  }
  for (const candidate of keywordCandidates) {
    const existing = scoreMap.get(candidate.chunkId);
    if (existing) {
      existing.keywordScore = candidate.score;
    } else {
      scoreMap.set(candidate.chunkId, {
        id: candidate.chunkId,
        vectorScore: 0,
        keywordScore: candidate.score,
      });
    }
  }

  // Stage 1: Weighted merge + minScore filter.
  const merged = Array.from(scoreMap.values())
    .map((entry) => ({
      ...entry,
      finalScore: entry.vectorScore * weights.vector + entry.keywordScore * weights.text,
    }))
    .filter((entry) => entry.finalScore >= minScore)
    .sort((a, b) => b.finalScore - a.finalScore);

  // Stage 2: Load full details for all candidates (needed for decay + MMR).
  // We load more than maxResults because decay and MMR will re-rank them.
  const ids = merged.map((entry) => entry.id);
  const details = params.db.loadResultsByIds(ids);
  const byId = new Map<number, MemorySearchResult>();
  for (const [index, detail] of details.entries()) {
    const id = ids[index];
    if (id !== undefined) {
      byId.set(id, detail);
    }
  }

  let results: MemorySearchResult[] = merged
    .map((entry) => {
      const detail = byId.get(entry.id);
      if (!detail) {
        return null;
      }
      const source =
        entry.vectorScore > 0 && entry.keywordScore > 0
          ? 'both'
          : entry.vectorScore > 0
            ? 'vector'
            : 'keyword';
      return {
        ...detail,
        snippet: buildSnippet(detail.snippet, 700),
        score: entry.finalScore,
        source,
      } as MemorySearchResult;
    })
    .filter((entry): entry is MemorySearchResult => Boolean(entry));

  // Stage 3: Temporal decay — recent memories score higher, MEMORY.md stays evergreen.
  if (params.temporalDecay?.enabled) {
    results = applyTemporalDecay({
      results,
      config: params.temporalDecay,
    });
    results.sort((a, b) => b.score - a.score);
  }

  // Stage 4: MMR re-ranking — ensure diversity in results.
  if (params.mmr?.enabled) {
    // Feed MMR more candidates than final maxResults for better diversity selection.
    const mmrInput = results.slice(0, maxResults * 2);
    results = applyMMRToHybridResults(mmrInput, params.mmr);
  }

  // Stage 5: Final top-K selection.
  return results.slice(0, maxResults);
}
