import { describe, expect, test, afterEach } from 'bun:test';
import {
  hasConfiguredClient,
  hasUsableCredentials,
  getAuthStatus,
  getCredentialsPath,
} from './auth.js';

describe('tastytrade auth', () => {
  const origId = process.env.TASTYTRADE_CLIENT_ID;
  const origSecret = process.env.TASTYTRADE_CLIENT_SECRET;

  afterEach(() => {
    if (origId !== undefined) process.env.TASTYTRADE_CLIENT_ID = origId;
    else delete process.env.TASTYTRADE_CLIENT_ID;
    if (origSecret !== undefined) process.env.TASTYTRADE_CLIENT_SECRET = origSecret;
    else delete process.env.TASTYTRADE_CLIENT_SECRET;
  });

  describe('hasConfiguredClient', () => {
    test('returns false when TASTYTRADE_CLIENT_ID is unset', () => {
      delete process.env.TASTYTRADE_CLIENT_ID;
      process.env.TASTYTRADE_CLIENT_SECRET = 'secret';
      expect(hasConfiguredClient()).toBe(false);
    });

    test('returns false when TASTYTRADE_CLIENT_SECRET is unset', () => {
      process.env.TASTYTRADE_CLIENT_ID = 'id';
      delete process.env.TASTYTRADE_CLIENT_SECRET;
      expect(hasConfiguredClient()).toBe(false);
    });

    test('returns false when client id is empty string', () => {
      process.env.TASTYTRADE_CLIENT_ID = '  ';
      process.env.TASTYTRADE_CLIENT_SECRET = 'secret';
      expect(hasConfiguredClient()).toBe(false);
    });

    test('returns true when both set and non-empty', () => {
      process.env.TASTYTRADE_CLIENT_ID = 'id';
      process.env.TASTYTRADE_CLIENT_SECRET = 'secret';
      expect(hasConfiguredClient()).toBe(true);
    });
  });

  describe('getAuthStatus', () => {
    test('returns configured false and operatorState not_connected when client not set', () => {
      delete process.env.TASTYTRADE_CLIENT_ID;
      delete process.env.TASTYTRADE_CLIENT_SECRET;
      const status = getAuthStatus();
      expect(status.configured).toBe(false);
      expect(status.hasCredentials).toBe(false);
      expect(status.operatorState).toBe('not_connected');
      expect(status.credentialsPath).toContain('tastytrade-credentials');
      expect(status.message).toMatch(/TASTYTRADE_CLIENT_ID|PRD-TASTYTRADE/);
    });
  });

  describe('getCredentialsPath', () => {
    test('returns path under .dexter', () => {
      const path = getCredentialsPath();
      expect(path).toContain('.dexter');
      expect(path).toContain('tastytrade-credentials.json');
    });
  });
});
