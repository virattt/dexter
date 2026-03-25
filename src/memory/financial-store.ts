import { createHash } from 'node:crypto';
import type { MemoryDatabase, FinancialInsightRecord } from './database.js';
import type { EdgeRelation, RoutingResult } from './financial-tags.js';

export interface FinancialInsight {
  id?: number;
  ticker: string;
  exchange?: string;
  sector?: string;
  tags: string[];
  content: string;
  routing?: RoutingResult;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface RelatedInsight {
  insight: FinancialInsight;
  relation: string;
  confidence: number;
}

function rowToInsight(row: FinancialInsightRecord): FinancialInsight {
  return {
    id: row.id,
    ticker: row.ticker,
    exchange: row.exchange ?? undefined,
    sector: row.sector ?? undefined,
    tags: JSON.parse(row.tags || '[]') as string[],
    content: row.content,
    routing: (row.routing as RoutingResult) ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function computeHash(ticker: string, content: string): string {
  return createHash('sha256').update(`${ticker.toUpperCase()}:${content}`).digest('hex');
}

export class FinancialMemoryStore {
  constructor(private readonly db: MemoryDatabase) {}

  async storeInsight(params: Omit<FinancialInsight, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const contentHash = computeHash(params.ticker, params.content);
    return this.db.upsertInsight({
      ticker: params.ticker,
      exchange: params.exchange,
      sector: params.sector,
      tags: JSON.stringify(params.tags),
      content: params.content,
      contentHash,
      routing: params.routing,
      source: params.source,
    });
  }

  recallByTicker(ticker: string): FinancialInsight[] {
    return this.db.searchInsightsByTicker(ticker).map(rowToInsight);
  }

  search(
    query: string,
    options?: { tags?: string[]; ticker?: string; maxResults?: number },
  ): FinancialInsight[] {
    let results = this.db.searchInsightsFts(query, options?.maxResults ?? 6).map(rowToInsight);
    if (options?.tags?.length) {
      results = results.filter((i) => options.tags!.some((t) => i.tags.includes(t)));
    }
    if (options?.ticker) {
      const upper = options.ticker.toUpperCase();
      results = results.filter((i) => i.ticker.toUpperCase() === upper);
    }
    return results;
  }

  getRouting(ticker: string): RoutingResult | null {
    const insights = this.recallByTicker(ticker);
    const sorted = insights.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    for (const insight of sorted) {
      if (insight.routing) return insight.routing;
    }
    return null;
  }

  addEdge(sourceId: number, targetId: number, relation: EdgeRelation, confidence = 1.0): void {
    this.db.addEdge(sourceId, targetId, relation, confidence);
  }

  getRelatedInsights(insightId: number): RelatedInsight[] {
    const edges = this.db.getEdgesForInsight(insightId);
    const results: RelatedInsight[] = [];
    for (const edge of edges) {
      const otherId = edge.source_id === insightId ? edge.target_id : edge.source_id;
      const row = this.db.getInsightById(otherId);
      if (row) {
        results.push({ insight: rowToInsight(row), relation: edge.relation, confidence: edge.confidence });
      }
    }
    return results;
  }

  /** Format recent insights as compact context text for system prompt injection. */
  static formatForContext(insights: FinancialInsight[], limit = 10): string {
    return insights
      .slice(0, limit)
      .map((i) => {
        const routing = i.routing ? ` [${i.routing}]` : '';
        const excerpt = i.content.length > 120 ? `${i.content.slice(0, 120)}…` : i.content;
        return `- **${i.ticker}**${routing}: ${excerpt}`;
      })
      .join('\n');
  }
}
