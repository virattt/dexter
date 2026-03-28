import { describe, expect, it, beforeEach } from 'bun:test';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60_000, name: 'test' });
  });

  it('starts CLOSED', () => {
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });

  it('stays CLOSED below the failure threshold', () => {
    cb.onFailure();
    cb.onFailure();
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });

  it('opens after reaching the failure threshold', () => {
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.currentState).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('resets consecutive failure count on success', () => {
    cb.onFailure();
    cb.onFailure();
    cb.onSuccess();
    expect(cb.consecutiveFailures).toBe(0);
    expect(cb.currentState).toBe('CLOSED');
  });

  it('transitions to HALF_OPEN after resetTimeoutMs elapses', () => {
    const fast = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    fast.onFailure(); // opens immediately
    expect(fast.isOpen()).toBe(false); // 0ms timeout already elapsed
    expect(fast.currentState).toBe('HALF_OPEN');
  });

  it('closes from HALF_OPEN on success', () => {
    const fast = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    fast.onFailure();
    fast.isOpen(); // transitions to HALF_OPEN
    fast.onSuccess();
    expect(fast.currentState).toBe('CLOSED');
  });

  it('re-opens from HALF_OPEN on failure', () => {
    const fast = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 0 });
    fast.onFailure();
    fast.isOpen(); // transitions to HALF_OPEN
    fast.onFailure();
    expect(fast.currentState).toBe('OPEN');
  });

  describe('call() helper', () => {
    it('executes the function and returns result when CLOSED', async () => {
      const result = await cb.call(() => Promise.resolve(42), 0);
      expect(result).toBe(42);
    });

    it('returns fallback immediately when OPEN', async () => {
      cb.onFailure(); cb.onFailure(); cb.onFailure(); // open it
      let called = false;
      const result = await cb.call(async () => { called = true; return 99; }, -1);
      expect(result).toBe(-1);
      expect(called).toBe(false);
    });

    it('counts failure and returns fallback on thrown error', async () => {
      await cb.call(() => Promise.reject(new Error('boom')), 'fallback');
      expect(cb.consecutiveFailures).toBe(1);
    });

    it('opens circuit after threshold failures through call()', async () => {
      const fail = () => Promise.reject(new Error('x'));
      await cb.call(fail, null);
      await cb.call(fail, null);
      await cb.call(fail, null);
      expect(cb.currentState).toBe('OPEN');
    });
  });
});
