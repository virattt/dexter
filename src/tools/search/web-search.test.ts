import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SearchSelectionController } from '../../controllers/search-selection.js';
import { getSetting, setSetting } from '../../utils/config.js';
import { createSearchProviderSelector } from '../../components/select-list.js';
import { createWebSearchTool, getWebSearchProviders, type WebSearchProvider } from './web-search.js';

const keys = ['EXASEARCH_API_KEY', 'PERPLEXITY_API_KEY', 'TAVILY_API_KEY', 'LANGSEARCH_API_KEY'];
const originalDir = process.cwd();
let directory: string;
let savedKeys: (string | undefined)[];
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'dexter-search-'));
  process.chdir(directory);
  savedKeys = keys.map((key) => process.env[key]);
  keys.forEach((key) => { delete process.env[key]; });
});
afterEach(() => {
  process.chdir(originalDir);
  keys.forEach((key, i) => {
    if (savedKeys[i] === undefined) delete process.env[key];
    else process.env[key] = savedKeys[i];
  });
  rmSync(directory, { recursive: true, force: true });
});

describe('web search selection', () => {
  test('preserves no-provider behavior and the incumbent key-based order', () => {
    expect(getWebSearchProviders()).toEqual([]);
    keys.forEach((key) => { process.env[key] = 'fixture-key'; });
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['exa', 'perplexity', 'tavily', 'langsearch']);
    setSetting('webSearchPreferredProvider', 'tavily');
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['tavily', 'exa', 'perplexity', 'langsearch']);
    delete process.env.TAVILY_API_KEY;
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['exa', 'perplexity', 'langsearch']);
  });

  test('the real picker saves Parallel without a key prompt or dummy credential', () => {
    const controller = new SearchSelectionController((message) => { throw new Error(message); });
    expect(controller.preferredProvider).toBe('exa');
    controller.startSelection();
    const selector = createSearchProviderSelector('exa', (id) => controller.handleProviderSelect(id), () => controller.cancelSelection());
    for (let i = 0; i < 4; i++) selector.handleInput('\u001b[B');
    selector.handleInput('\r');
    expect(controller.state.appState).toBe('idle');
    expect(controller.preferredProvider).toBe('parallel');
    expect(getSetting('webSearchPreferredProvider', '')).toBe('parallel');
    expect(JSON.parse(readFileSync('.dexter/settings.json', 'utf8')).webSearchPreferredProvider).toBe('parallel');
    expect(existsSync('.env')).toBe(false);
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['parallel']);
  });

  test('Parallel is first only while selected and leaves keyed fallbacks in order', () => {
    keys.forEach((key) => { process.env[key] = 'fixture-key'; });
    const controller = new SearchSelectionController(() => {});
    controller.handleProviderSelect('parallel');
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['parallel', 'exa', 'perplexity', 'tavily', 'langsearch']);
    controller.handleProviderSelect('tavily');
    expect(getWebSearchProviders().map((p) => p.id)).toEqual(['tavily', 'exa', 'perplexity', 'langsearch']);
  });

  test('existing providers still require a key and cancellation preserves preference', () => {
    const controller = new SearchSelectionController(() => {});
    controller.handleProviderSelect('parallel');
    controller.handleProviderSelect('exa');
    expect(controller.state.appState).toBe('api_key_confirm');
    controller.cancelSelection();
    expect(controller.preferredProvider).toBe('parallel');
  });
});

function fixtureProvider(id: WebSearchProvider['id'], run: () => Promise<string>): WebSearchProvider {
  return { id, name: id, tool: new DynamicStructuredTool({
    name: 'web_search', description: 'Fixture', schema: z.object({ query: z.string() }), func: run,
  }) };
}

describe('web search invocation', () => {
  test('tries failures in order and returns the first success', async () => {
    const calls: string[] = [];
    const tool = createWebSearchTool([
      fixtureProvider('parallel', async () => { calls.push('parallel'); throw new Error('unavailable'); }),
      fixtureProvider('exa', async () => { calls.push('exa'); return 'evidence'; }),
      fixtureProvider('tavily', async () => { calls.push('tavily'); return 'unused'; }),
    ]);
    expect(await tool.invoke({ query: 'example' })).toBe('evidence');
    expect(calls).toEqual(['parallel', 'exa']);
  });

  test('cancellation prevents dispatch to another fallback', async () => {
    const controller = new AbortController();
    let fallbackCalled = false;
    const tool = createWebSearchTool([
      fixtureProvider('parallel', async () => { controller.abort(); throw new Error('canceled'); }),
      fixtureProvider('exa', async () => { fallbackCalled = true; return 'unused'; }),
    ]);
    await expect(tool.invoke({ query: 'example' }, { signal: controller.signal })).rejects.toThrow();
    expect(fallbackCalled).toBe(false);
  });
});
