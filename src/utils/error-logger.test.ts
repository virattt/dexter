import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyError } from './errors.js';

// ---------------------------------------------------------------------------
// Isolation: each test gets its own tmp dir so log files don't accumulate.
// ---------------------------------------------------------------------------
let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `error-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Import logError freshly so getDexterDir() uses the chdir'd cwd. */
async function getLogError() {
  const { logError } = await import('./error-logger.js');
  return logError;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logError', () => {
  it('creates the log file if it does not exist', async () => {
    const logError = await getLogError();
    const logFile = join(tmpDir, '.dexter', 'logs', 'errors.jsonl');

    expect(existsSync(logFile)).toBe(false);

    logError({ type: 'unknown', message: 'test error' });

    expect(existsSync(logFile)).toBe(true);
  });

  it('writes valid JSON lines', async () => {
    const logError = await getLogError();
    const logFile = join(tmpDir, '.dexter', 'logs', 'errors.jsonl');

    logError({ type: 'rate_limit', message: 'Too many requests', context: 'tool:web_search' });
    logError({ type: 'auth', message: 'Unauthorized', context: 'tool:financial_search' });

    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('type');
      expect(parsed).toHaveProperty('message');
      // Timestamps should be valid ISO 8601
      expect(() => new Date(parsed.timestamp)).not.toThrow();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    }
  });

  it('includes optional fields when provided', async () => {
    const logError = await getLogError();
    const logFile = join(tmpDir, '.dexter', 'logs', 'errors.jsonl');

    logError({
      type: 'network_dns_failure',
      message: 'getaddrinfo ENOTFOUND example.com',
      context: 'tool:browser',
      stack: 'Error: getaddrinfo ENOTFOUND\n  at ...',
    });

    const line = readFileSync(logFile, 'utf-8').trim();
    const parsed = JSON.parse(line);
    expect(parsed.context).toBe('tool:browser');
    expect(parsed.stack).toContain('ENOTFOUND');
  });

  it('silently succeeds even if the dir is unwritable', async () => {
    const logError = await getLogError();
    const logsDir = join(tmpDir, '.dexter', 'logs');
    mkdirSync(logsDir, { recursive: true });

    // Make directory read-only so writes fail
    try {
      chmodSync(logsDir, 0o444);
    } catch {
      // Skip chmod if not supported (e.g. running as root)
      return;
    }

    // Should not throw
    expect(() => logError({ type: 'unknown', message: 'test' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// classifyError — new network patterns
// ---------------------------------------------------------------------------

describe('classifyError — network patterns', () => {
  it('classifies ENOTFOUND as network_dns_failure', () => {
    expect(classifyError('getaddrinfo ENOTFOUND api.example.com')).toBe('network_dns_failure');
  });

  it('classifies ECONNREFUSED as network_connection_refused', () => {
    expect(classifyError('connect ECONNREFUSED 127.0.0.1:3000')).toBe('network_connection_refused');
  });

  it('classifies ECONNRESET as network_connection_reset', () => {
    expect(classifyError('read ECONNRESET')).toBe('network_connection_reset');
  });

  it('classifies ETIMEDOUT as network_timeout', () => {
    expect(classifyError('connect ETIMEDOUT 1.2.3.4:443')).toBe('network_timeout');
  });

  it('classifies certificate error as network_tls_error', () => {
    expect(classifyError('certificate has expired')).toBe('network_tls_error');
  });

  it('classifies SSL error as network_tls_error', () => {
    expect(classifyError('SSL handshake failed')).toBe('network_tls_error');
  });

  it('classifies TLS error as network_tls_error', () => {
    expect(classifyError('TLS verification error')).toBe('network_tls_error');
  });

  it('classifies rate limit in message as rate_limit', () => {
    expect(classifyError('rate limit exceeded')).toBe('rate_limit');
  });

  it('classifies 429 as rate_limit', () => {
    expect(classifyError('HTTP 429 too many requests')).toBe('rate_limit');
  });

  it('preserves existing classifications (context_overflow)', () => {
    expect(classifyError('context length exceeded')).toBe('context_overflow');
  });

  it('returns unknown for unrecognized errors', () => {
    expect(classifyError('something completely unexpected')).toBe('unknown');
  });
});
