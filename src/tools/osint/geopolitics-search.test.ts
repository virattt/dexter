/**
 * Unit tests for the geopolitics OSINT tool.
 *
 * All tests are pure / offline — no network calls.
 * External fetch calls (GDELT, Bluesky) are mocked.
 */

import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test';

import { detectCategories, getAssetImplications, buildGdeltThemeFilter, getMappingForCategory } from './event-asset-map.js';
import { parseGdeltDate, deduplicateArticles } from './gdelt.js';
import { deduplicatePosts, bskyUriToWebUrl } from './bluesky.js';
import { buildGdeltQuery, buildBskyQuery, classifyText, calculateConfidence, flagWatchlistAssets } from './geopolitics-search.js';
import { getSourcesByCategory, getDomainsForCategory, OSINT_SOURCES } from './accounts.js';

// ──────────────────────────────────────────────────────────────────────────────
// event-asset-map: detectCategories
// ──────────────────────────────────────────────────────────────────────────────

describe('detectCategories', () => {
  test('detects ukraine-russia from text', () => {
    const cats = detectCategories('Ukraine and Russia sign ceasefire in Kyiv');
    expect(cats).toContain('ukraine-russia');
  });

  test('detects china-taiwan from semiconductor context', () => {
    const cats = detectCategories('PLA military exercises near Taiwan strait threaten TSMC supply');
    expect(cats).toContain('china-taiwan');
  });

  test('detects middle-east from Houthi attack', () => {
    const cats = detectCategories('Houthi attack on Red Sea tanker threatens Strait of Hormuz');
    expect(cats).toContain('middle-east');
  });

  test('detects cyberattack from infrastructure text', () => {
    const cats = detectCategories('Nation-state ransomware attack on critical infrastructure power grid');
    expect(cats).toContain('cyberattack');
  });

  test('detects sanctions from OFAC text', () => {
    const cats = detectCategories('OFAC issues new sanctions against entity list');
    expect(cats).toContain('sanctions');
  });

  test('detects us-china-trade from tariff text', () => {
    const cats = detectCategories('New tariffs on Chinese imports announced in trade war escalation');
    expect(cats).toContain('us-china-trade');
  });

  test('returns empty array for unrelated text', () => {
    const cats = detectCategories('The quick brown fox jumps over the lazy dog');
    expect(cats).toHaveLength(0);
  });

  test('detects multiple categories in same text', () => {
    const cats = detectCategories('Russia sanctions escalation and cyberattack on Ukraine power grid');
    expect(cats).toContain('ukraine-russia');
    expect(cats).toContain('cyberattack');
    expect(cats).toContain('sanctions');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// event-asset-map: getAssetImplications
// ──────────────────────────────────────────────────────────────────────────────

describe('getAssetImplications', () => {
  test('returns implications for ukraine-russia', () => {
    const implications = getAssetImplications(['ukraine-russia']);
    expect(implications.length).toBeGreaterThan(0);
    const tickers = implications.map((i) => i.ticker);
    expect(tickers).toContain('LMT');
    expect(tickers).toContain('GLD');
  });

  test('returns implications for china-taiwan', () => {
    const implications = getAssetImplications(['china-taiwan']);
    const tickers = implications.map((i) => i.ticker);
    expect(tickers).toContain('TSM');
    expect(tickers).toContain('NVDA');
  });

  test('deduplicates by highest confidence when ticker appears in multiple categories', () => {
    const implications = getAssetImplications(['ukraine-russia', 'middle-east']);
    const gldEntries = implications.filter((i) => i.ticker === 'GLD');
    expect(gldEntries).toHaveLength(1);
  });

  test('returns empty array for empty categories', () => {
    expect(getAssetImplications([])).toHaveLength(0);
  });

  test('sorts by confidence descending', () => {
    const implications = getAssetImplications(['china-taiwan']);
    for (let i = 1; i < implications.length; i++) {
      expect(implications[i - 1].confidence).toBeGreaterThanOrEqual(implications[i].confidence);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// event-asset-map: buildGdeltThemeFilter
// ──────────────────────────────────────────────────────────────────────────────

describe('buildGdeltThemeFilter', () => {
  test('returns empty string for empty categories', () => {
    expect(buildGdeltThemeFilter([])).toBe('');
  });

  test('builds correct filter for ukraine-russia', () => {
    const filter = buildGdeltThemeFilter(['ukraine-russia']);
    expect(filter).toContain('THEME:MILITARY_CONFLICT');
    expect(filter).toContain('THEME:SANCTION');
  });

  test('deduplicates shared themes across categories', () => {
    const filter = buildGdeltThemeFilter(['ukraine-russia', 'middle-east']);
    const count = (filter.match(/THEME:MILITARY_CONFLICT/g) ?? []).length;
    expect(count).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// gdelt: parseGdeltDate
// ──────────────────────────────────────────────────────────────────────────────

describe('parseGdeltDate', () => {
  test('parses valid GDELT date string', () => {
    const d = parseGdeltDate('20240115143022');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(0); // January
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(22);
  });

  test('returns epoch for invalid date', () => {
    const d = parseGdeltDate('invalid');
    expect(d.getTime()).toBe(0);
  });
});

describe('deduplicateArticles', () => {
  test('removes duplicate URLs', () => {
    const articles = [
      { url: 'http://a.com', title: 'A', seendate: '20240101000000', domain: 'a.com', language: 'English', sourcecountry: 'US' },
      { url: 'http://a.com', title: 'A dup', seendate: '20240101010000', domain: 'a.com', language: 'English', sourcecountry: 'US' },
      { url: 'http://b.com', title: 'B', seendate: '20240101000000', domain: 'b.com', language: 'English', sourcecountry: 'UK' },
    ];
    const deduped = deduplicateArticles(articles);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].url).toBe('http://a.com');
    expect(deduped[1].url).toBe('http://b.com');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// bluesky: utilities
// ──────────────────────────────────────────────────────────────────────────────

describe('bskyUriToWebUrl', () => {
  test('converts AT URI to web URL', () => {
    const uri = 'at://did:plc:abc123/app.bsky.feed.post/xyz789';
    const url = bskyUriToWebUrl(uri);
    expect(url).toBe('https://bsky.app/profile/did:plc:abc123/post/xyz789');
  });

  test('returns original for invalid URI', () => {
    const uri = 'not-an-at-uri';
    expect(bskyUriToWebUrl(uri)).toBe('not-an-at-uri');
  });
});

describe('deduplicatePosts', () => {
  test('removes duplicate URIs', () => {
    const posts = [
      { uri: 'at://a', authorHandle: 'x', authorDisplayName: 'X', text: 'hi', createdAt: '', likeCount: 0, repostCount: 0, replyCount: 0 },
      { uri: 'at://a', authorHandle: 'x', authorDisplayName: 'X', text: 'hi dup', createdAt: '', likeCount: 0, repostCount: 0, replyCount: 0 },
      { uri: 'at://b', authorHandle: 'y', authorDisplayName: 'Y', text: 'world', createdAt: '', likeCount: 0, repostCount: 0, replyCount: 0 },
    ];
    expect(deduplicatePosts(posts)).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// geopolitics-search: pure logic functions
// ──────────────────────────────────────────────────────────────────────────────

describe('buildGdeltQuery', () => {
  test('includes topic keywords', () => {
    const q = buildGdeltQuery('Russia Ukraine ceasefire');
    expect(q).toContain('russia');
    expect(q).toContain('ukraine');
    expect(q).toContain('ceasefire');
  });

  test('appends theme filter when categories provided', () => {
    const q = buildGdeltQuery('ukraine', ['ukraine-russia']);
    expect(q).toContain('THEME:');
  });

  test('limits to 6 topic words', () => {
    const q = buildGdeltQuery('one two three four five six seven eight');
    const topicPart = q.split('(')[0].trim();
    const words = topicPart.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(6);
  });
});

describe('buildBskyQuery', () => {
  test('returns topic when no categories', () => {
    const q = buildBskyQuery('Ukraine ceasefire talks');
    expect(q).toContain('Ukraine');
  });

  test('appends category hints', () => {
    const q = buildBskyQuery('sanctions news', ['sanctions', 'ukraine-russia']);
    expect(q.length).toBeGreaterThan('sanctions news'.length);
  });
});

describe('classifyText', () => {
  test('uses explicit categories when no keyword match found', () => {
    const cats = classifyText('random unrelated text', ['ukraine-russia']);
    expect(cats).toContain('ukraine-russia');
  });

  test('filters explicit categories to only those with keyword matches when matches exist', () => {
    const cats = classifyText('Ukraine conflict update', ['ukraine-russia', 'china-taiwan']);
    expect(cats).toContain('ukraine-russia');
    // china-taiwan should be dropped since no keywords match
    expect(cats).not.toContain('china-taiwan');
  });

  test('falls back to general-conflict when auto-detect finds nothing', () => {
    const cats = classifyText('random text with no keywords');
    expect(cats).toContain('general-conflict');
  });
});

describe('calculateConfidence', () => {
  test('high when many events from multiple sources', () => {
    expect(calculateConfidence(15, 3)).toBe('high');
  });

  test('medium when modest event count', () => {
    expect(calculateConfidence(7, 1)).toBe('medium');
  });

  test('low when few events single source', () => {
    expect(calculateConfidence(2, 1)).toBe('low');
  });
});

describe('flagWatchlistAssets', () => {
  const implications = [
    { ticker: 'LMT', name: 'Lockheed', assetClass: 'equity' as const, direction: 'risk-up' as const, rationale: 'defense', confidence: 0.85 },
    { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf' as const, direction: 'risk-up' as const, rationale: 'safe-haven', confidence: 0.80 },
    { ticker: 'XOM', name: 'ExxonMobil', assetClass: 'equity' as const, direction: 'risk-up' as const, rationale: 'oil', confidence: 0.75 },
  ];

  test('flags tickers in watchlist', () => {
    const result = flagWatchlistAssets(implications, ['LMT', 'AAPL']);
    const lmt = result.find((a) => a.ticker === 'LMT')!;
    const gld = result.find((a) => a.ticker === 'GLD')!;
    expect(lmt.isWatchlistTicker).toBe(true);
    expect(gld.isWatchlistTicker).toBe(false);
  });

  test('case-insensitive matching', () => {
    const result = flagWatchlistAssets(implications, ['lmt']);
    expect(result.find((a) => a.ticker === 'LMT')?.isWatchlistTicker).toBe(true);
  });

  test('returns empty array for empty implications', () => {
    expect(flagWatchlistAssets([], ['LMT'])).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// accounts: helpers
// ──────────────────────────────────────────────────────────────────────────────

describe('OSINT accounts registry', () => {
  test('has at least 15 sources', () => {
    expect(OSINT_SOURCES.length).toBeGreaterThanOrEqual(15);
  });

  test('getSourcesByCategory returns relevant sources for ukraine-russia', () => {
    const sources = getSourcesByCategory('ukraine-russia');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => s.eventCategories.includes('ukraine-russia'))).toBe(true);
  });

  test('getDomainsForCategory returns non-empty domains', () => {
    const domains = getDomainsForCategory('middle-east');
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.every((d) => d.includes('.'))).toBe(true);
  });

  test('all high-reliability sources have webDomain or blueskyHandle', () => {
    const highRel = OSINT_SOURCES.filter((s) => s.reliability === 'high');
    const allHaveIdentifier = highRel.every((s) => s.webDomain ?? s.blueskyHandle);
    expect(allHaveIdentifier).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getMappingForCategory
// ──────────────────────────────────────────────────────────────────────────────

describe('getMappingForCategory', () => {
  test('returns mapping for valid category', () => {
    const m = getMappingForCategory('cyberattack');
    expect(m).toBeDefined();
    expect(m?.category).toBe('cyberattack');
    expect(m?.assets.length).toBeGreaterThan(0);
  });

  test('returns undefined for nonexistent category', () => {
    // @ts-expect-error intentional bad category for test
    expect(getMappingForCategory('nonexistent-category')).toBeUndefined();
  });
});
