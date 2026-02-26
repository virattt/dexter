import { describe, test, expect } from 'bun:test';
import { createProgressChannel } from './progress-channel.js';

describe('createProgressChannel', () => {
  test('drains buffered messages in order', async () => {
    const channel = createProgressChannel();
    channel.emit('Searching...');
    channel.emit('Fetching filings...');
    channel.close();

    const received: string[] = [];
    for await (const msg of channel) {
      received.push(msg);
    }

    expect(received).toEqual(['Searching...', 'Fetching filings...']);
  });

  test('delivers messages to a waiting consumer', async () => {
    const channel = createProgressChannel();
    const iterator = channel[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    queueMicrotask(() => channel.emit('Running tool...'));

    const first = await nextPromise;
    expect(first.done).toBe(false);
    expect(first.value).toBe('Running tool...');

    channel.close();
    const end = await iterator.next();
    expect(end.done).toBe(true);
  });

  test('close unblocks pending next with done=true', async () => {
    const channel = createProgressChannel();
    const iterator = channel[Symbol.asyncIterator]();

    const pending = iterator.next();
    channel.close();

    const result = await pending;
    expect(result.done).toBe(true);
  });
});

