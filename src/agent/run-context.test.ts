/**
 * Unit tests for createRunContext and the RunContext shape.
 *
 * File system isolation: chdir into a tmpdir before each test so that
 * Scratchpad JSONL files do not accumulate in the project tree.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRunContext } from './run-context.js';
import { Scratchpad } from './scratchpad.js';
import { TokenCounter } from './token-counter.js';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `run-ctx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Shape & initial values
// ---------------------------------------------------------------------------

describe('createRunContext — shape', () => {
  it('returns an object with all required fields', () => {
    const ctx = createRunContext('AAPL revenue growth');
    expect(ctx).toHaveProperty('query');
    expect(ctx).toHaveProperty('scratchpad');
    expect(ctx).toHaveProperty('tokenCounter');
    expect(ctx).toHaveProperty('startTime');
    expect(ctx).toHaveProperty('iteration');
  });

  it('stores the query exactly as provided', () => {
    const ctx = createRunContext('What is the current BTC price?');
    expect(ctx.query).toBe('What is the current BTC price?');
  });

  it('initialises iteration to 0', () => {
    const ctx = createRunContext('any query');
    expect(ctx.iteration).toBe(0);
  });

  it('startTime is within the last 5 seconds', () => {
    const before = Date.now();
    const ctx = createRunContext('timing test');
    const after = Date.now();
    expect(ctx.startTime).toBeGreaterThanOrEqual(before);
    expect(ctx.startTime).toBeLessThanOrEqual(after);
  });

  it('scratchpad is a Scratchpad instance', () => {
    const ctx = createRunContext('scratchpad check');
    expect(ctx.scratchpad).toBeInstanceOf(Scratchpad);
  });

  it('tokenCounter is a TokenCounter instance', () => {
    const ctx = createRunContext('token counter check');
    expect(ctx.tokenCounter).toBeInstanceOf(TokenCounter);
  });
});

// ---------------------------------------------------------------------------
// Isolation — each call creates independent instances
// ---------------------------------------------------------------------------

describe('createRunContext — isolation', () => {
  it('two calls return separate Scratchpad instances', () => {
    const ctx1 = createRunContext('query one');
    const ctx2 = createRunContext('query two');
    expect(ctx1.scratchpad).not.toBe(ctx2.scratchpad);
  });

  it('two calls return separate TokenCounter instances', () => {
    const ctx1 = createRunContext('query one');
    const ctx2 = createRunContext('query two');
    expect(ctx1.tokenCounter).not.toBe(ctx2.tokenCounter);
  });

  it('mutating iteration on one context does not affect another', () => {
    const ctx1 = createRunContext('a');
    const ctx2 = createRunContext('b');
    ctx1.iteration = 5;
    expect(ctx2.iteration).toBe(0);
  });

  it('recording a tool result on one scratchpad does not affect another', () => {
    const ctx1 = createRunContext('shared test 1');
    const ctx2 = createRunContext('shared test 2');
    ctx1.scratchpad.addToolResult('web_search', { q: 'test' }, 'result');
    expect(ctx2.scratchpad.hasToolResults()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mutable vs readonly fields
// ---------------------------------------------------------------------------

describe('createRunContext — mutability', () => {
  it('iteration can be incremented', () => {
    const ctx = createRunContext('loop test');
    ctx.iteration++;
    ctx.iteration++;
    expect(ctx.iteration).toBe(2);
  });

  it('query field is a string (structural readonly — no runtime enforcement needed)', () => {
    const ctx = createRunContext('readonly test');
    expect(typeof ctx.query).toBe('string');
  });
});
