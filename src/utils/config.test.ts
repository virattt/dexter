import { describe, it, expect } from 'bun:test';
import { validateConfigValue } from './config.js';

describe('validateConfigValue — maxIterations', () => {
  it('accepts a value within range', () => {
    const result = validateConfigValue('maxIterations', 30);
    expect(result.valid).toBe(true);
  });

  it('rejects a value below the minimum (2 < 5)', () => {
    const result = validateConfigValue('maxIterations', 2);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a value above the maximum (200 > 100)', () => {
    const result = validateConfigValue('maxIterations', 200);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a non-numeric value', () => {
    const result = validateConfigValue('maxIterations', 'abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts the boundary minimum (5)', () => {
    expect(validateConfigValue('maxIterations', 5).valid).toBe(true);
  });

  it('accepts the boundary maximum (100)', () => {
    expect(validateConfigValue('maxIterations', 100).valid).toBe(true);
  });
});

describe('validateConfigValue — contextThreshold', () => {
  it('accepts a value within range', () => {
    const result = validateConfigValue('contextThreshold', 50000);
    expect(result.valid).toBe(true);
  });

  it('rejects a value below minimum', () => {
    expect(validateConfigValue('contextThreshold', 5000).valid).toBe(false);
  });

  it('rejects a value above maximum', () => {
    expect(validateConfigValue('contextThreshold', 600000).valid).toBe(false);
  });
});

describe('validateConfigValue — keepToolUses', () => {
  it('accepts a value within range', () => {
    const result = validateConfigValue('keepToolUses', 10);
    expect(result.valid).toBe(true);
  });

  it('rejects a value below minimum', () => {
    expect(validateConfigValue('keepToolUses', 1).valid).toBe(false);
  });

  it('rejects a value above maximum', () => {
    expect(validateConfigValue('keepToolUses', 25).valid).toBe(false);
  });
});

describe('validateConfigValue — cacheTtlMs', () => {
  it('accepts a valid TTL', () => {
    expect(validateConfigValue('cacheTtlMs', 900000).valid).toBe(true);
  });

  it('rejects a TTL below minimum', () => {
    expect(validateConfigValue('cacheTtlMs', 30000).valid).toBe(false);
  });
});

describe('validateConfigValue — parallelToolLimit', () => {
  it('accepts 0 (unlimited)', () => {
    expect(validateConfigValue('parallelToolLimit', 0).valid).toBe(true);
  });

  it('accepts a positive limit', () => {
    expect(validateConfigValue('parallelToolLimit', 5).valid).toBe(true);
  });

  it('rejects a value above maximum', () => {
    expect(validateConfigValue('parallelToolLimit', 11).valid).toBe(false);
  });
});

describe('validateConfigValue — unknown keys', () => {
  it('passes through without validation', () => {
    const result = validateConfigValue('unknownKey', 5);
    expect(result.valid).toBe(true);
  });

  it('passes through string values for unknown keys', () => {
    const result = validateConfigValue('unknownKey', 'some-string');
    expect(result.valid).toBe(true);
  });
});
