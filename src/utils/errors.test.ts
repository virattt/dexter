import { describe, test, expect } from 'bun:test';
import {
  parseApiErrorInfo,
  classifyError,
  isContextOverflowError,
  isRateLimitError,
  isBillingError,
  isAuthError,
  isTimeoutError,
  isOverloadedError,
  isNonRetryableError,
  formatUserFacingError,
} from './errors.js';

// ---------------------------------------------------------------------------
// parseApiErrorInfo
// ---------------------------------------------------------------------------

describe('parseApiErrorInfo', () => {
  test('returns null for empty or undefined input', () => {
    expect(parseApiErrorInfo()).toBeNull();
    expect(parseApiErrorInfo('')).toBeNull();
    expect(parseApiErrorInfo('   ')).toBeNull();
  });

  test('returns null for non-JSON strings', () => {
    expect(parseApiErrorInfo('something went wrong')).toBeNull();
    expect(parseApiErrorInfo('plain text error')).toBeNull();
  });

  test('parses standard error envelope { error: { type, message } }', () => {
    const raw = JSON.stringify({
      error: { type: 'invalid_request_error', message: 'Bad request' },
    });
    const info = parseApiErrorInfo(raw);
    expect(info).toEqual({
      httpCode: undefined,
      type: 'invalid_request_error',
      code: undefined,
      message: 'Bad request',
      requestId: undefined,
    });
  });

  test('parses Anthropic-style { type: "error", error: { type, message } }', () => {
    const raw = JSON.stringify({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    const info = parseApiErrorInfo(raw);
    expect(info).toEqual({
      httpCode: undefined,
      type: 'overloaded_error',
      message: 'Overloaded',
      requestId: undefined,
    });
  });

  test('parses flat { message, type, code } payloads', () => {
    const raw = JSON.stringify({
      message: 'Rate limit exceeded',
      type: 'rate_limit',
      code: 'rate_limit_exceeded',
    });
    const info = parseApiErrorInfo(raw);
    expect(info).toEqual({
      httpCode: undefined,
      type: 'rate_limit',
      code: 'rate_limit_exceeded',
      message: 'Rate limit exceeded',
      requestId: undefined,
    });
  });

  test('extracts request_id (snake_case)', () => {
    const raw = JSON.stringify({
      error: { type: 'server_error', message: 'Internal' },
      request_id: 'req-abc123',
    });
    const info = parseApiErrorInfo(raw);
    expect(info?.requestId).toBe('req-abc123');
  });

  test('extracts requestId (camelCase)', () => {
    const raw = JSON.stringify({
      error: { type: 'server_error', message: 'Internal' },
      requestId: 'req-xyz789',
    });
    const info = parseApiErrorInfo(raw);
    expect(info?.requestId).toBe('req-xyz789');
  });

  test('strips common error prefixes before parsing', () => {
    const payload = JSON.stringify({ message: 'Something failed' });
    expect(parseApiErrorInfo(`[Error] ${payload}`)?.message).toBe('Something failed');
    expect(parseApiErrorInfo(`API Error: ${payload}`)?.message).toBe('Something failed');
  });

  test('extracts HTTP status code from prefix', () => {
    const payload = JSON.stringify({ message: 'Not found' });
    const info = parseApiErrorInfo(`404 ${payload}`);
    expect(info?.httpCode).toBe(404);
    expect(info?.message).toBe('Not found');
  });

  test('returns null when JSON has no recognizable fields', () => {
    const raw = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(parseApiErrorInfo(raw)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

describe('isRateLimitError', () => {
  test('detects common rate limit patterns', () => {
    expect(isRateLimitError('Rate limit exceeded')).toBe(true);
    expect(isRateLimitError('429 Too Many Requests')).toBe(true);
    expect(isRateLimitError('model_cooldown')).toBe(true);
    expect(isRateLimitError('Exceeded your current quota')).toBe(true);
    expect(isRateLimitError('resource has been exhausted')).toBe(true);
    expect(isRateLimitError('resource_exhausted')).toBe(true);
    expect(isRateLimitError('usage limit')).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isRateLimitError('invalid api key')).toBe(false);
    expect(isRateLimitError('timeout')).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe('isContextOverflowError', () => {
  test('detects context overflow patterns', () => {
    expect(isContextOverflowError('context length exceeded')).toBe(true);
    expect(isContextOverflowError("This model's maximum context length is 128k")).toBe(true);
    expect(isContextOverflowError('prompt is too long')).toBe(true);
    expect(isContextOverflowError('request_too_large')).toBe(true);
  });

  test('detects Chinese context overflow messages', () => {
    expect(isContextOverflowError('上下文过长')).toBe(true);
    expect(isContextOverflowError('上下文超出')).toBe(true);
    expect(isContextOverflowError('超出最大上下文')).toBe(true);
  });

  test('detects compound patterns', () => {
    expect(isContextOverflowError('request size exceeds the context limit')).toBe(true);
    expect(isContextOverflowError('max_tokens exceed the context window')).toBe(true);
    expect(isContextOverflowError('input length exceeds context limit')).toBe(true);
    expect(isContextOverflowError('413 payload too large')).toBe(true);
  });

  test('does not misclassify TPM rate limits as context overflow', () => {
    expect(isContextOverflowError('tpm limit exceeded')).toBe(false);
    expect(isContextOverflowError('tokens per minute limit reached')).toBe(false);
  });

  test('returns false for unrelated errors', () => {
    expect(isContextOverflowError('invalid api key')).toBe(false);
    expect(isContextOverflowError(undefined)).toBe(false);
  });
});

describe('isBillingError', () => {
  test('detects billing patterns', () => {
    expect(isBillingError('payment required')).toBe(true);
    expect(isBillingError('insufficient credits')).toBe(true);
    expect(isBillingError('credit balance is too low')).toBe(true);
    expect(isBillingError('HTTP 402')).toBe(true);
    expect(isBillingError('"status": 402')).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isBillingError('rate limit')).toBe(false);
    expect(isBillingError(undefined)).toBe(false);
  });
});

describe('isAuthError', () => {
  test('detects auth patterns', () => {
    expect(isAuthError('invalid api key')).toBe(true);
    expect(isAuthError('invalid_api_key')).toBe(true);
    expect(isAuthError('incorrect api key provided')).toBe(true);
    expect(isAuthError('unauthorized')).toBe(true);
    expect(isAuthError('forbidden')).toBe(true);
    expect(isAuthError('access denied')).toBe(true);
    expect(isAuthError('401 Unauthorized')).toBe(true);
    expect(isAuthError('403 Forbidden')).toBe(true);
    expect(isAuthError('No API key found')).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isAuthError('rate limit')).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe('isTimeoutError', () => {
  test('detects timeout patterns', () => {
    expect(isTimeoutError('request timed out')).toBe(true);
    expect(isTimeoutError('timeout')).toBe(true);
    expect(isTimeoutError('deadline exceeded')).toBe(true);
    expect(isTimeoutError('context deadline exceeded')).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isTimeoutError('rate limit')).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});

describe('isOverloadedError', () => {
  test('detects overloaded patterns', () => {
    expect(isOverloadedError('overloaded_error')).toBe(true);
    expect(isOverloadedError('"type": "overloaded_error"')).toBe(true);
    expect(isOverloadedError('service unavailable')).toBe(true);
    expect(isOverloadedError('The API is experiencing high demand')).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isOverloadedError('invalid api key')).toBe(false);
    expect(isOverloadedError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  test('returns "unknown" for empty/undefined input', () => {
    expect(classifyError(undefined)).toBe('unknown');
    expect(classifyError('')).toBe('unknown');
  });

  test('classifies each error type correctly', () => {
    expect(classifyError('context length exceeded')).toBe('context_overflow');
    expect(classifyError('rate limit exceeded')).toBe('rate_limit');
    expect(classifyError('payment required')).toBe('billing');
    expect(classifyError('invalid api key')).toBe('auth');
    expect(classifyError('request timed out')).toBe('timeout');
    expect(classifyError('overloaded_error')).toBe('overloaded');
    expect(classifyError('some random failure')).toBe('unknown');
  });

  test('priority: context_overflow beats rate_limit for TPM-like strings', () => {
    // A string mentioning "context length exceeded" should be context_overflow
    // even if it also mentions other keywords, because context_overflow is checked first
    expect(classifyError('context length exceeded')).toBe('context_overflow');
  });
});

// ---------------------------------------------------------------------------
// isNonRetryableError
// ---------------------------------------------------------------------------

describe('isNonRetryableError', () => {
  test('context overflow, billing, and auth are non-retryable', () => {
    expect(isNonRetryableError('context length exceeded')).toBe(true);
    expect(isNonRetryableError('payment required')).toBe(true);
    expect(isNonRetryableError('invalid api key')).toBe(true);
  });

  test('rate limit, timeout, overloaded are retryable', () => {
    expect(isNonRetryableError('rate limit exceeded')).toBe(false);
    expect(isNonRetryableError('request timed out')).toBe(false);
    expect(isNonRetryableError('overloaded_error')).toBe(false);
  });

  test('unknown errors are retryable', () => {
    expect(isNonRetryableError('something went wrong')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatUserFacingError
// ---------------------------------------------------------------------------

describe('formatUserFacingError', () => {
  test('returns fallback for empty string', () => {
    expect(formatUserFacingError('')).toBe('LLM request failed with an unknown error.');
    expect(formatUserFacingError('   ')).toBe('LLM request failed with an unknown error.');
  });

  test('formats context overflow with actionable advice', () => {
    const msg = formatUserFacingError('context length exceeded');
    expect(msg).toContain('Context overflow');
    expect(msg).toContain('new conversation');
  });

  test('formats rate limit with provider label', () => {
    const msg = formatUserFacingError('rate limit exceeded', 'OpenAI');
    expect(msg).toContain('OpenAI');
    expect(msg).toContain('rate limit');
  });

  test('formats rate limit without provider', () => {
    const msg = formatUserFacingError('rate limit exceeded');
    expect(msg).toContain('rate limit');
    expect(msg).not.toContain('undefined');
  });

  test('formats billing error with provider', () => {
    const msg = formatUserFacingError('payment required', 'Anthropic');
    expect(msg).toContain('Anthropic');
    expect(msg).toContain('credits');
  });

  test('formats auth error with provider', () => {
    const msg = formatUserFacingError('invalid api key', 'Google');
    expect(msg).toContain('Google');
    expect(msg).toContain('invalid or expired');
  });

  test('formats timeout error', () => {
    const msg = formatUserFacingError('request timed out');
    expect(msg).toContain('timed out');
  });

  test('formats overloaded error', () => {
    const msg = formatUserFacingError('overloaded_error');
    expect(msg).toContain('overloaded');
  });

  test('formats unknown JSON error with parsed info', () => {
    const raw = JSON.stringify({
      error: { type: 'server_error', message: 'Internal server error' },
      request_id: 'req-123',
    });
    const msg = formatUserFacingError(raw);
    expect(msg).toContain('Internal server error');
    expect(msg).toContain('server_error');
    expect(msg).toContain('req-123');
  });

  test('truncates very long unknown error messages', () => {
    const longMessage = 'x'.repeat(500);
    const msg = formatUserFacingError(longMessage);
    expect(msg.length).toBeLessThan(400);
    expect(msg).toContain('...');
  });

  test('returns raw message if short and unclassified', () => {
    const raw = 'Unexpected server failure';
    expect(formatUserFacingError(raw)).toBe(raw);
  });
});
