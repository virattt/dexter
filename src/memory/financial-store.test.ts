import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MemoryDatabase } from './database.js';
import { FinancialMemoryStore, getTtlMs, isExpired } from './financial-store.js';
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

describe('getTtlMs / isExpired', () => {
  it('routing tags never expire', () => {
    expect(getTtlMs(['routing:fmp-ok'])).toBe(Infinity);
    expect(getTtlMs(['routing:fmp-premium'])).toBe(Infinity);
    expect(isExpired({ tags: ['routing:yahoo-ok'], updatedAt: 0 })).toBe(false);
  });

  it('analysis:consensus expires after 7 days', () => {
    const sevenDaysMs = 7 * 24 * 3600 * 1000;
    expect(getTtlMs(['analysis:consensus'])).toBe(sevenDaysMs);
    const eightDaysAgo = Date.now() - 8 * 24 * 3600 * 1000;
    expect(isExpired({ tags: ['analysis:consensus'], updatedAt: eightDaysAgo })).toBe(true);
    const sixDaysAgo = Date.now() - 6 * 24 * 3600 * 1000;
    expect(isExpired({ tags: ['analysis:consensus'], updatedAt: sixDaysAgo })).toBe(false);
  });

  it('analysis:valuation expires after 90 days', () => {
    const ninetyOneDaysAgo = Date.now() - 91 * 24 * 3600 * 1000;
    expect(isExpired({ tags: ['analysis:valuation'], updatedAt: ninetyOneDaysAgo })).toBe(true);
    const eightNineDaysAgo = Date.now() - 89 * 24 * 3600 * 1000;
    expect(isExpired({ tags: ['analysis:valuation'], updatedAt: eightNineDaysAgo })).toBe(false);
  });

  it('analysis:thesis and analysis:risk expire after 90 days', () => {
    const ninetyOneDaysAgo = Date.now() - 91 * 24 * 3600 * 1000;
    expect(isExpired({ tags: ['analysis:thesis'], updatedAt: ninetyOneDaysAgo })).toBe(true);
    expect(isExpired({ tags: ['analysis:risk'], updatedAt: ninetyOneDaysAgo })).toBe(true);
  });

  it('untagged entries expire after 60 days', () => {
    const sixtyOneDaysAgo = Date.now() - 61 * 24 * 3600 * 1000;
    expect(isExpired({ tags: [], updatedAt: sixtyOneDaysAgo })).toBe(true);
    const fiftyNineDaysAgo = Date.now() - 59 * 24 * 3600 * 1000;
    expect(isExpired({ tags: [], updatedAt: fiftyNineDaysAgo })).toBe(false);
  });

  it('uses createdAt as fallback when updatedAt is absent', () => {
    const ninetyOneDaysAgo = Date.now() - 61 * 24 * 3600 * 1000;
    expect(isExpired({ tags: [], createdAt: ninetyOneDaysAgo })).toBe(true);
  });
});

describe('recallByTicker TTL filtering', () => {
  let dbPath2: string;
  let db2: MemoryDatabase;
  let store2: FinancialMemoryStore;

  beforeEach(async () => {
    dbPath2 = join(tmpdir(), `dexter-ttl-test-${Date.now()}.sqlite`);
    db2 = await MemoryDatabase.create(dbPath2);
    store2 = new FinancialMemoryStore(db2);
  });

  afterEach(async () => {
    db2.close();
    await rm(dbPath2, { force: true });
  });

  it('filters out expired entries from recallByTicker', async () => {
    const id = await store2.storeInsight({ ticker: 'AAPL', content: 'old insight', tags: [] });
    // Backdate the entry to 70 days ago (> 60-day default TTL)
    db2['db'].query('UPDATE financial_insights SET updated_at = ? WHERE id = ?').run(
      Date.now() - 70 * 24 * 3600 * 1000,
      id,
    );
    const results = store2.recallByTicker('AAPL');
    expect(results).toHaveLength(0);
  });

  it('returns fresh entries from recallByTicker', async () => {
    await store2.storeInsight({ ticker: 'AAPL', content: 'fresh insight', tags: [] });
    const results = store2.recallByTicker('AAPL');
    expect(results).toHaveLength(1);
  });

  it('routing insights are never filtered even when very old', async () => {
    const id = await store2.storeInsight({
      ticker: 'VWS.CO',
      content: 'routing insight',
      tags: [Tags.routing(RoutingResults.FMP_PREMIUM)],
    });
    db2['db'].query('UPDATE financial_insights SET updated_at = ? WHERE id = ?').run(
      Date.now() - 365 * 24 * 3600 * 1000, // 1 year old
      id,
    );
    const results = store2.recallByTicker('VWS.CO');
    expect(results).toHaveLength(1);
  });

  it('analyst consensus entries expire after 7 days', async () => {
    const id = await store2.storeInsight({
      ticker: 'MSFT',
      content: 'analyst consensus from last month',
      tags: ['analysis:consensus'],
    });
    db2['db'].query('UPDATE financial_insights SET updated_at = ? WHERE id = ?').run(
      Date.now() - 8 * 24 * 3600 * 1000, // 8 days old
      id,
    );
    expect(store2.recallByTicker('MSFT')).toHaveLength(0);
  });

  it('search() also filters expired entries', async () => {
    const id = await store2.storeInsight({ ticker: 'TSLA', content: 'Tesla old note', tags: [] });
    db2['db'].query('UPDATE financial_insights SET updated_at = ? WHERE id = ?').run(
      Date.now() - 70 * 24 * 3600 * 1000,
      id,
    );
    const results = store2.search('Tesla old note');
    expect(results).toHaveLength(0);
  });
});
