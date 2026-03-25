import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MemoryDatabase } from './database.js';
import { FinancialMemoryStore } from './financial-store.js';
import { EdgeRelations, RoutingResults, Tags } from './financial-tags.js';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let dbPath: string;
let db: MemoryDatabase;
let store: FinancialMemoryStore;

beforeEach(async () => {
  dbPath = join(tmpdir(), `dexter-test-${Date.now()}.sqlite`);
  db = await MemoryDatabase.create(dbPath);
  store = new FinancialMemoryStore(db);
});

afterEach(async () => {
  db.close();
  await rm(dbPath, { force: true });
});

describe('MemoryDatabase financial schema', () => {
  it('creates financial_insights table', () => {
    const rows = db['db'].query<{ name: string }>('PRAGMA table_info(financial_insights)').all();
    const names = rows.map((r) => r.name);
    expect(names).toContain('id');
    expect(names).toContain('ticker');
    expect(names).toContain('tags');
    expect(names).toContain('content');
    expect(names).toContain('routing');
    expect(names).toContain('updated_at');
  });

  it('creates knowledge_graph_edges table', () => {
    const rows = db['db'].query<{ name: string }>('PRAGMA table_info(knowledge_graph_edges)').all();
    const names = rows.map((r) => r.name);
    expect(names).toContain('source_id');
    expect(names).toContain('target_id');
    expect(names).toContain('relation');
    expect(names).toContain('confidence');
  });

  it('upserts an insight and returns an id', () => {
    const id = db.upsertInsight({
      ticker: 'AAPL',
      tags: '["ticker:AAPL"]',
      content: 'Apple is profitable',
      contentHash: 'abc123',
    });
    expect(id).toBeGreaterThan(0);
  });

  it('deduplicates by content_hash on upsert', () => {
    const id1 = db.upsertInsight({ ticker: 'AAPL', tags: '[]', content: 'First', contentHash: 'hash1' });
    const id2 = db.upsertInsight({ ticker: 'AAPL', tags: '[]', content: 'Updated', contentHash: 'hash1' });
    expect(id1).toBe(id2);
    const row = db.getInsightById(id1);
    expect(row?.content).toBe('Updated');
  });

  it('searchInsightsByTicker returns matching rows', () => {
    db.upsertInsight({ ticker: 'VWS.CO', tags: '[]', content: 'Vestas wind', contentHash: 'v1' });
    db.upsertInsight({ ticker: 'AAPL', tags: '[]', content: 'Apple', contentHash: 'a1' });
    const results = db.searchInsightsByTicker('VWS.CO');
    expect(results).toHaveLength(1);
    expect(results[0]?.ticker).toBe('VWS.CO');
  });

  it('searchInsightsByTicker is case-insensitive', () => {
    db.upsertInsight({ ticker: 'VWS.CO', tags: '[]', content: 'Vestas', contentHash: 'vws1' });
    expect(db.searchInsightsByTicker('vws.co')).toHaveLength(1);
  });

  it('searchInsightsFts finds content by keyword', () => {
    db.upsertInsight({ ticker: 'VWS.CO', tags: '[]', content: 'Vestas wind turbine manufacturer', contentHash: 'vws2' });
    const results = db.searchInsightsFts('turbine', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.ticker).toBe('VWS.CO');
  });

  it('loadRecentInsights returns rows ordered by updated_at desc', async () => {
    db.upsertInsight({ ticker: 'A', tags: '[]', content: 'first', contentHash: 'h1' });
    await new Promise((r) => setTimeout(r, 2));
    db.upsertInsight({ ticker: 'B', tags: '[]', content: 'second', contentHash: 'h2' });
    const rows = db.loadRecentInsights(10);
    expect(rows[0]?.ticker).toBe('B');
    expect(rows[1]?.ticker).toBe('A');
  });

  it('addEdge and getEdgesForInsight round-trip', () => {
    const id1 = db.upsertInsight({ ticker: 'A', tags: '[]', content: 'a', contentHash: 'ea1' });
    const id2 = db.upsertInsight({ ticker: 'B', tags: '[]', content: 'b', contentHash: 'eb1' });
    db.addEdge(id1, id2, 'causes');
    const edges = db.getEdgesForInsight(id1);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.relation).toBe('causes');
    expect(edges[0]?.target_id).toBe(id2);
  });
});

describe('FinancialMemoryStore', () => {
  it('storeInsight returns an id', async () => {
    const id = await store.storeInsight({ ticker: 'AAPL', content: 'Apple thesis', tags: ['analysis:thesis'] });
    expect(id).toBeGreaterThan(0);
  });

  it('recallByTicker returns stored insight', async () => {
    await store.storeInsight({ ticker: 'VWS.CO', content: 'Vestas wind', tags: [] });
    const results = store.recallByTicker('VWS.CO');
    expect(results).toHaveLength(1);
    expect(results[0]?.ticker).toBe('VWS.CO');
  });

  it('getRouting returns the routing result', async () => {
    await store.storeInsight({
      ticker: 'VWS.CO',
      content: 'FMP premium',
      tags: [Tags.routing(RoutingResults.FMP_PREMIUM)],
      routing: RoutingResults.FMP_PREMIUM,
    });
    expect(store.getRouting('VWS.CO')).toBe('fmp-premium');
  });

  it('getRouting returns null when no routing stored', async () => {
    await store.storeInsight({ ticker: 'AAPL', content: 'No routing', tags: [] });
    expect(store.getRouting('AAPL')).toBeNull();
  });

  it('search finds insights by keyword', async () => {
    await store.storeInsight({ ticker: 'VWS.CO', content: 'Vestas turbine blades', tags: [] });
    await store.storeInsight({ ticker: 'AAPL', content: 'Apple iPhone margins', tags: [] });
    const results = store.search('turbine');
    expect(results.some((r) => r.ticker === 'VWS.CO')).toBe(true);
  });

  it('getRelatedInsights traverses edges', async () => {
    const id1 = await store.storeInsight({ ticker: 'A', content: 'cause event', tags: [] });
    const id2 = await store.storeInsight({ ticker: 'B', content: 'effect event', tags: [] });
    store.addEdge(id1, id2, EdgeRelations.CAUSES);
    const related = store.getRelatedInsights(id1);
    expect(related).toHaveLength(1);
    expect(related[0]?.insight.ticker).toBe('B');
    expect(related[0]?.relation).toBe('causes');
  });

  it('formatForContext produces compact bullet lines', async () => {
    const insights = [
      { ticker: 'VWS.CO', routing: RoutingResults.FMP_PREMIUM, content: 'Some insight', tags: [] },
    ];
    const text = FinancialMemoryStore.formatForContext(insights);
    expect(text).toContain('VWS.CO');
    expect(text).toContain('fmp-premium');
  });
});

describe('financial-tags', () => {
  it('Tags helpers produce correct strings', () => {
    expect(Tags.ticker('aapl')).toBe('ticker:AAPL');
    expect(Tags.routing(RoutingResults.FMP_PREMIUM)).toBe('routing:fmp-premium');
    expect(Tags.sector('Energy')).toBe('sector:energy');
    expect(Tags.exchange('cph')).toBe('exchange:CPH');
  });
});
