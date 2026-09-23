import { describe, expect, test } from 'bun:test';
import { InMemoryChatHistory } from './in-memory-chat-history.js';

/** Builds a history whose summaries need no LLM call. */
function historyWithoutLlm(): InMemoryChatHistory {
  const history = new InMemoryChatHistory('gpt-5.5');
  (history as unknown as { generateSummary: () => Promise<string> }).generateSummary = async () => 'summary';
  return history;
}

describe('follow-ups picked up mid-run', () => {
  test('become their own user messages on the open turn', async () => {
    const history = historyWithoutLlm();
    history.saveUserQuery('Pull NVDA latest earnings');
    history.addFollowUpToOpenTurn('And AMD too');
    await history.saveAnswer('Both beat.');

    const [turn] = history.getMessages();
    expect(turn.query).toBe('Pull NVDA latest earnings');
    expect(turn.followUps).toEqual(['And AMD too']);

    const messages = history.getRecentTurnsAsMessages();
    expect(messages.map(m => m.getType())).toEqual(['human', 'human', 'ai']);
    expect(messages[1].content).toBe('And AMD too');
  });

  test('are ignored once the turn has an answer', async () => {
    const history = historyWithoutLlm();
    history.saveUserQuery('Pull NVDA latest earnings');
    await history.saveAnswer('Done.');
    history.addFollowUpToOpenTurn('Too late');

    expect(history.getMessages()[0].followUps).toEqual([]);
  });
});
