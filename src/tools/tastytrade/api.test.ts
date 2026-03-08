import { describe, expect, test } from 'bun:test';
import { tastytradeRequest, getAccounts } from './api.js';

describe('tastytrade api', () => {
  test('getAccounts is a function', () => {
    expect(typeof getAccounts).toBe('function');
  });

  test('tastytradeRequest throws when not authenticated', async () => {
    await expect(tastytradeRequest('/customers/me/accounts')).rejects.toThrow(/not authenticated|tastytrade/);
  });
});
