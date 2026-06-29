import { describe, test, expect } from 'bun:test';
import { runShell } from './shell-runner.js';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForDeath = async (pid: number, timeoutMs = 3000): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!alive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !alive(pid);
};

describe('runShell — basic capture', () => {
  test('captures stdout and exit code 0', async () => {
    const r = await runShell('echo hello');
    expect(r.stdout.trim()).toBe('hello');
    expect(r.exitCode).toBe(0);
    expect(r.interrupted).toBe(false);
  });

  test('captures stderr and a non-zero exit code', async () => {
    const r = await runShell('echo oops >&2; exit 3');
    expect(r.stderr.trim()).toBe('oops');
    expect(r.exitCode).toBe(3);
  });
});

describe('runShell — timeout', () => {
  test('an over-long command is killed and flagged timedOut', async () => {
    const r = await runShell('sleep 5', { timeoutMs: 200 });
    expect(r.timedOut).toBe(true);
    expect(r.interrupted).toBe(true);
    expect(r.exitCode).toBe(null);
  });
});

describe('runShell — abort', () => {
  test('an external AbortSignal kills the command', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 100);
    const r = await runShell('sleep 5', { signal: ac.signal, timeoutMs: 10_000 });
    expect(r.interrupted).toBe(true);
    expect(r.timedOut).toBe(false);
  });

  test('an already-aborted signal kills immediately', async () => {
    const r = await runShell('sleep 5', { signal: AbortSignal.abort(), timeoutMs: 10_000 });
    expect(r.interrupted).toBe(true);
  });
});

describe('runShell — process-group tree-kill (the critical guarantee)', () => {
  test('a backgrounded grandchild is reaped when the command is killed', async () => {
    // Background a long sleep, print its PID, then block. Timeout kills the GROUP.
    const r = await runShell('sleep 30 & echo $!; wait', { timeoutMs: 300 });
    expect(r.interrupted).toBe(true);
    const grandchildPid = Number.parseInt(r.stdout.trim().split('\n')[0] ?? '', 10);
    expect(Number.isInteger(grandchildPid)).toBe(true);
    // The backgrounded sleep must die too (group kill), not leak as an orphan.
    expect(await waitForDeath(grandchildPid)).toBe(true);
  });
});

describe('runShell — spawn failure is reported, never rejected', () => {
  test('a non-existent cwd resolves with an error result (no throw)', async () => {
    const r = await runShell('echo hi', { cwd: '/no/such/dir/xyz-does-not-exist' });
    expect(r.exitCode).toBe(null);
    expect(r.stderr.length).toBeGreaterThan(0);
  });
});

describe('runShell — output cap', () => {
  test('output exceeding the byte cap is truncated and the command is killed', async () => {
    const r = await runShell('cat /dev/zero', { maxOutputBytes: 4096, timeoutMs: 5000 });
    expect(r.truncated).toBe(true);
    expect(r.interrupted).toBe(true);
    expect(r.stdout.length).toBeLessThanOrEqual(4096);
  });
});
