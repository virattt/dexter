/**
 * Maximal Marginal Relevance (MMR) re-ranking algorithm.
 *
 * MMR balances relevance with diversity by iteratively selecting results
 * that maximize: λ * relevance - (1-λ) * max_similarity_to_selected
 *
 * Ported from Openclaw (MIT licensed).
 * @see Carbonell & Goldstein, "The Use of MMR, Diversity-Based Reranking" (1998)
 */

import type { MMRConfig, MemorySearchResult } from './types.js';

export const DEFAULT_MMR_CONFIG: MMRConfig = {
  enabled: true,
  lambda: 0.7,
};

type MMRItem = {
  id: string;
  score: number;
  content: string;
};

/**
 * Tokenize text for Jaccard similarity computation.
 * Extracts alphanumeric tokens and normalizes to lowercase.
 */
export function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  return new Set(tokens);
}

/**
 * Compute Jaccard similarity between two token sets.
 * Returns a value in [0, 1] where 1 means identical sets.
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger = setA.size <= setB.size ? setB : setA;

  for (const token of smaller) {
    if (larger.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function maxSimilarityToSelected(
  item: MMRItem,
  selectedItems: MMRItem[],
  tokenCache: Map<string, Set<string>>,
): number {
  if (selectedItems.length === 0) {
    return 0;
  }

  let maxSim = 0;
  const itemTokens = tokenCache.get(item.id) ?? tokenize(item.content);

  for (const selected of selectedItems) {
    const selectedTokens = tokenCache.get(selected.id) ?? tokenize(selected.content);
    const sim = jaccardSimilarity(itemTokens, selectedTokens);
    if (sim > maxSim) {
      maxSim = sim;
    }
  }

  return maxSim;
}

function computeMMRScore(relevance: number, maxSimilarity: number, lambda: number): number {
  return lambda * relevance - (1 - lambda) * maxSimilarity;
}

/**
 * Re-rank items using Maximal Marginal Relevance (MMR).
 *
 * The algorithm iteratively selects items that balance relevance with diversity:
 * 1. Start with the highest-scoring item
 * 2. For each remaining slot, select the item that maximizes the MMR score
 * 3. MMR score = λ * relevance - (1-λ) * max_similarity_to_already_selected
 */
function mmrRerank<T extends MMRItem>(items: T[], config: Partial<MMRConfig> = {}): T[] {
  const { enabled = DEFAULT_MMR_CONFIG.enabled, lambda = DEFAULT_MMR_CONFIG.lambda } = config;

  if (!enabled || items.length <= 1) {
    return [...items];
  }

  const clampedLambda = Math.max(0, Math.min(1, lambda));

  if (clampedLambda === 1) {
    return [...items].sort((a, b) => b.score - a.score);
  }

  // Pre-tokenize all items for efficiency.
  const tokenCache = new Map<string, Set<string>>();
  for (const item of items) {
    tokenCache.set(item.id, tokenize(item.content));
  }

  // Normalize scores to [0, 1] for fair comparison with similarity.
  const maxScore = Math.max(...items.map((i) => i.score));
  const minScore = Math.min(...items.map((i) => i.score));
  const scoreRange = maxScore - minScore;

  const normalizeScore = (score: number): number => {
    if (scoreRange === 0) {
      return 1;
    }
    return (score - minScore) / scoreRange;
  };

  const selected: T[] = [];
  const remaining = new Set(items);

  while (remaining.size > 0) {
    let bestItem: T | null = null;
    let bestMMRScore = -Infinity;

    for (const candidate of remaining) {
      const normalizedRelevance = normalizeScore(candidate.score);
      const maxSim = maxSimilarityToSelected(candidate, selected, tokenCache);
      const mmrScore = computeMMRScore(normalizedRelevance, maxSim, clampedLambda);

      if (
        mmrScore > bestMMRScore ||
        (mmrScore === bestMMRScore && candidate.score > (bestItem?.score ?? -Infinity))
      ) {
        bestMMRScore = mmrScore;
        bestItem = candidate;
      }
    }

    if (bestItem) {
      selected.push(bestItem);
      remaining.delete(bestItem);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Apply MMR re-ranking to hybrid search results.
 * Adapts the generic MMR function to work with the hybrid search result format.
 */
export function applyMMRToHybridResults(
  results: MemorySearchResult[],
  config: Partial<MMRConfig> = {},
): MemorySearchResult[] {
  if (results.length === 0) {
    return results;
  }

  const itemById = new Map<string, MemorySearchResult>();

  const mmrItems: MMRItem[] = results.map((r, index) => {
    const id = `${r.path}:${r.startLine}:${index}`;
    itemById.set(id, r);
    return {
      id,
      score: r.score,
      content: r.snippet,
    };
  });

  const reranked = mmrRerank(mmrItems, config);

  return reranked.map((item) => itemById.get(item.id)!);
}
