import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { LongTermChatHistory } from './long-term-chat-history.js';

const TEST_BASE_DIR = '.dexter-long-term-history-tests';

function getMessagesFilePath(): string {
  return join(TEST_BASE_DIR, '.dexter', 'messages', 'chat_history.json');
}

beforeEach(() => {
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true });
  }
});

describe('LongTermChatHistory', () => {
  test('load creates an empty history file when none exists', async () => {
    const history = new LongTermChatHistory(TEST_BASE_DIR);
    await history.load();

    const filePath = getMessagesFilePath();
    expect(existsSync(filePath)).toBe(true);

    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(Array.isArray(parsed.messages)).toBe(true);
    expect(parsed.messages.length).toBe(0);
  });

  test('addUserMessage prepends messages in stack order (newest first)', async () => {
    const history = new LongTermChatHistory(TEST_BASE_DIR);

    await history.addUserMessage('First');
    await history.addUserMessage('Second');
    await history.addUserMessage('Third');

    const messages = history.getMessages();
    expect(messages.map((m) => m.userMessage)).toEqual(['Third', 'Second', 'First']);
    expect(messages[0].agentResponse).toBeNull();
  });

  test('updateAgentResponse updates the most recent entry', async () => {
    const history = new LongTermChatHistory(TEST_BASE_DIR);

    await history.addUserMessage('Question');
    await history.updateAgentResponse('Answer');

    const messages = history.getMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].userMessage).toBe('Question');
    expect(messages[0].agentResponse).toBe('Answer');
  });

  test('getMessageStrings deduplicates consecutive duplicate user messages only', async () => {
    const history = new LongTermChatHistory(TEST_BASE_DIR);

    await history.addUserMessage('AAPL');
    await history.addUserMessage('AAPL');
    await history.addUserMessage('NVDA');
    await history.addUserMessage('AAPL');

    const strings = history.getMessageStrings();
    expect(strings).toEqual(['AAPL', 'NVDA', 'AAPL']);
  });

  test('enforces maxEntries when adding messages', async () => {
    const history = new LongTermChatHistory(TEST_BASE_DIR, { maxEntries: 3 });

    for (let i = 0; i < 5; i++) {
      await history.addUserMessage(`Msg ${i}`);
    }

    const messages = history.getMessages();
    expect(messages.length).toBe(3);
    // Newest first
    expect(messages[0].userMessage).toBe('Msg 4');
    expect(messages[1].userMessage).toBe('Msg 3');
    expect(messages[2].userMessage).toBe('Msg 2');
  });

  test('load trims existing on-disk history to maxEntries', async () => {
    // First, create a history with more entries using a high maxEntries
    const history = new LongTermChatHistory(TEST_BASE_DIR, { maxEntries: 50 });

    for (let i = 0; i < 10; i++) {
      await history.addUserMessage(`Seed ${i}`);
    }

    // Sanity check
    expect(history.getMessages().length).toBe(10);

    // Now load with a tighter maxEntries
    const trimmedHistory = new LongTermChatHistory(TEST_BASE_DIR, { maxEntries: 3 });
    await trimmedHistory.load();

    const messages = trimmedHistory.getMessages();
    expect(messages.length).toBe(3);
    expect(messages[0].userMessage).toBe('Seed 9');
    expect(messages[2].userMessage).toBe('Seed 7');

    // On-disk file should also be trimmed
    const filePath = getMessagesFilePath();
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(Array.isArray(parsed.messages)).toBe(true);
    expect(parsed.messages.length).toBe(3);
  });
})

