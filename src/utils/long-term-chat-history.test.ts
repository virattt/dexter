import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LongTermChatHistory, type ConversationEntry } from './long-term-chat-history.js';

// ============================================================================
// Helpers
// ============================================================================

function makeHistory(dir: string): LongTermChatHistory {
  return new LongTermChatHistory(dir);
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `dexter-chat-history-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// Constructor / filePath
// ============================================================================

describe('LongTermChatHistory — constructor', () => {
  it('creates an instance without throwing', () => {
    expect(() => makeHistory(tmpDir)).not.toThrow();
  });

  it('starts in unloaded state — getMessages returns []', () => {
    const h = makeHistory(tmpDir);
    expect(h.getMessages()).toEqual([]);
  });
});

// ============================================================================
// load() — file not found (first run)
// ============================================================================

describe('LongTermChatHistory — load (no file)', () => {
  it('initialises to empty array and creates the file', async () => {
    const h = makeHistory(tmpDir);
    await h.load();
    expect(h.getMessages()).toEqual([]);
  });

  it('calling load twice is a no-op (idempotent)', async () => {
    const h = makeHistory(tmpDir);
    await h.load();
    await h.load(); // second call should be fast no-op
    expect(h.getMessages()).toEqual([]);
  });
});

// ============================================================================
// load() — existing file
// ============================================================================

describe('LongTermChatHistory — load (existing file)', () => {
  it('loads messages from a pre-existing JSON file', async () => {
    // Write a history file manually then reload
    const h1 = makeHistory(tmpDir);
    await h1.addUserMessage('first question');
    await h1.updateAgentResponse('first answer');

    const h2 = makeHistory(tmpDir);
    await h2.load();
    const msgs = h2.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].userMessage).toBe('first question');
    expect(msgs[0].agentResponse).toBe('first answer');
  });

  it('recovers gracefully from corrupt JSON (resets to empty)', async () => {
    // Create a corrupt JSON file
    const { mkdir, writeFile } = await import('node:fs/promises');
    const dir = join(tmpDir, '.dexter', 'messages');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'chat_history.json'), 'NOT VALID JSON', 'utf-8');

    const h = makeHistory(tmpDir);
    await h.load();
    expect(h.getMessages()).toEqual([]);
  });
});

// ============================================================================
// addUserMessage()
// ============================================================================

describe('LongTermChatHistory — addUserMessage', () => {
  it('adds a message and it appears at index 0 (stack order)', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('hello');
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].userMessage).toBe('hello');
    expect(msgs[0].agentResponse).toBeNull();
  });

  it('prepends newest message so most recent is at index 0', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('first');
    await h.addUserMessage('second');
    const msgs = h.getMessages();
    expect(msgs[0].userMessage).toBe('second');
    expect(msgs[1].userMessage).toBe('first');
  });

  it('auto-loads if not already loaded', async () => {
    const h = makeHistory(tmpDir);
    // Do NOT call load() — addUserMessage should trigger it
    await h.addUserMessage('auto-loaded');
    expect(h.getMessages()).toHaveLength(1);
  });

  it('persists messages to disk', async () => {
    const h1 = makeHistory(tmpDir);
    await h1.addUserMessage('persisted message');

    const h2 = makeHistory(tmpDir);
    await h2.load();
    expect(h2.getMessages()[0].userMessage).toBe('persisted message');
  });

  it('assigns a non-empty string id to each entry', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('test');
    const entry = h.getMessages()[0];
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
  });

  it('assigns a valid ISO timestamp', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('ts check');
    const entry = h.getMessages()[0];
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(isNaN(new Date(entry.timestamp).getTime())).toBe(false);
  });
});

// ============================================================================
// updateAgentResponse()
// ============================================================================

describe('LongTermChatHistory — updateAgentResponse', () => {
  it('sets agentResponse on the most recent entry', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('question');
    await h.updateAgentResponse('answer');
    expect(h.getMessages()[0].agentResponse).toBe('answer');
  });

  it('does not affect older entries', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('first');
    await h.addUserMessage('second');
    await h.updateAgentResponse('response to second');
    const msgs = h.getMessages();
    expect(msgs[0].agentResponse).toBe('response to second'); // second
    expect(msgs[1].agentResponse).toBeNull(); // first untouched
  });

  it('is a no-op when there are no messages', async () => {
    const h = makeHistory(tmpDir);
    await h.load();
    await expect(h.updateAgentResponse('orphan')).resolves.toBeUndefined();
    expect(h.getMessages()).toHaveLength(0);
  });

  it('auto-loads if not already loaded', async () => {
    const h1 = makeHistory(tmpDir);
    await h1.addUserMessage('q');

    const h2 = makeHistory(tmpDir);
    // Do NOT call load() — updateAgentResponse should trigger it
    await h2.updateAgentResponse('auto-loaded response');
    expect(h2.getMessages()[0].agentResponse).toBe('auto-loaded response');
  });

  it('persists the updated response to disk', async () => {
    const h1 = makeHistory(tmpDir);
    await h1.addUserMessage('q');
    await h1.updateAgentResponse('saved response');

    const h2 = makeHistory(tmpDir);
    await h2.load();
    expect(h2.getMessages()[0].agentResponse).toBe('saved response');
  });
});

// ============================================================================
// getMessages()
// ============================================================================

describe('LongTermChatHistory — getMessages', () => {
  it('returns a copy, not the internal reference', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('x');
    const copy1 = h.getMessages();
    const copy2 = h.getMessages();
    expect(copy1).not.toBe(copy2); // different array references
    expect(copy1).toEqual(copy2);  // same contents
  });

  it('returned copy mutations do not affect internal state', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('x');
    const copy = h.getMessages();
    copy.splice(0, 1); // remove from copy
    expect(h.getMessages()).toHaveLength(1); // internal unchanged
  });
});

// ============================================================================
// getMessageStrings()
// ============================================================================

describe('LongTermChatHistory — getMessageStrings', () => {
  it('returns empty array when no messages', async () => {
    const h = makeHistory(tmpDir);
    await h.load();
    expect(h.getMessageStrings()).toEqual([]);
  });

  it('returns user messages in stack order (newest first)', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('a');
    await h.addUserMessage('b');
    expect(h.getMessageStrings()).toEqual(['b', 'a']);
  });

  it('deduplicates consecutive identical messages', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('dup');
    await h.addUserMessage('dup'); // same message twice
    // stack order: [dup, dup] → deduplicated → ['dup']
    expect(h.getMessageStrings()).toEqual(['dup']);
  });

  it('keeps non-consecutive duplicates', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('a');
    await h.addUserMessage('b');
    await h.addUserMessage('a'); // repeated but not consecutive in array
    // stack order after 3 pushes: [a, b, a]
    // deduplicate consecutive: a→b (different, keep), b→a (different, keep)
    expect(h.getMessageStrings()).toEqual(['a', 'b', 'a']);
  });

  it('single message returns single-element array', async () => {
    const h = makeHistory(tmpDir);
    await h.addUserMessage('only one');
    expect(h.getMessageStrings()).toEqual(['only one']);
  });
});

// ============================================================================
// round-trip persistence
// ============================================================================

describe('LongTermChatHistory — round-trip persistence', () => {
  it('preserves a full conversation across two instances', async () => {
    const h1 = makeHistory(tmpDir);
    await h1.addUserMessage('What is AAPL P/E?');
    await h1.updateAgentResponse('AAPL P/E is ~28x TTM.');
    await h1.addUserMessage('And for MSFT?');

    const h2 = makeHistory(tmpDir);
    await h2.load();
    const msgs = h2.getMessages();

    expect(msgs).toHaveLength(2);
    expect(msgs[0].userMessage).toBe('And for MSFT?');
    expect(msgs[0].agentResponse).toBeNull();
    expect(msgs[1].userMessage).toBe('What is AAPL P/E?');
    expect(msgs[1].agentResponse).toBe('AAPL P/E is ~28x TTM.');
  });
});
