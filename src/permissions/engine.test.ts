import { describe, test, expect } from 'bun:test';
import { evaluatePermission, sessionKey } from './engine.js';

describe('evaluatePermission (Phase 0 — behavior parity)', () => {
  test('write_file and edit_file ask for approval', () => {
    expect(evaluatePermission({ tool: 'write_file', args: { path: 'x' } }).mode).toBe('ask');
    expect(evaluatePermission({ tool: 'edit_file', args: { path: 'x' } }).mode).toBe('ask');
  });

  test('read-only and other tools are auto-allowed', () => {
    for (const tool of ['read_file', 'get_financials', 'web_search', 'memory_search', 'skill']) {
      expect(evaluatePermission({ tool, args: {} }).mode).toBe('allow');
    }
  });

  test('every decision carries a reason', () => {
    expect(evaluatePermission({ tool: 'write_file', args: {} }).reason).toBeTruthy();
    expect(evaluatePermission({ tool: 'read_file', args: {} }).reason).toBeTruthy();
  });
});

describe('sessionKey', () => {
  test('write_file and edit_file share one key (legacy cross-approval parity)', () => {
    const d = evaluatePermission({ tool: 'write_file', args: {} });
    expect(sessionKey('write_file', d)).toBe(sessionKey('edit_file', d));
  });

  test('non-legacy tools key on their own name', () => {
    const d = evaluatePermission({ tool: 'some_tool', args: {} });
    expect(sessionKey('some_tool', d)).toBe('some_tool');
  });

  test('bash keys on the exact command', () => {
    const a = evaluatePermission({ tool: 'bash', args: { command: 'ls -la' } });
    const b = evaluatePermission({ tool: 'bash', args: { command: 'ls -lh' } });
    expect(sessionKey('bash', a)).toBe('bash:ls -la');
    expect(sessionKey('bash', a)).not.toBe(sessionKey('bash', b));
  });
});

describe('evaluatePermission — bash gate (Phase 1)', () => {
  const evalBash = (command: string) => evaluatePermission({ tool: 'bash', args: { command } });

  test('always asks, and carries the command', () => {
    const d = evalBash('ls -la');
    expect(d.mode).toBe('ask');
    expect(d.command).toBe('ls -la');
  });

  test('simple commands are session-cacheable', () => {
    for (const c of ['ls', 'ls -la', 'git status', 'cat foo.txt', 'rm -rf build', 'FOO=bar ls']) {
      expect(evalBash(c).sessionCacheable).toBe(true);
    }
  });

  test('metacharacter / dynamic commands are NOT cacheable', () => {
    const dangerous = [
      'ls && rm -rf /',
      'cat $(echo /etc/passwd)',
      'echo `whoami`',
      'ls | tee out.txt',
      'cat a; cat b',
      'echo ${HOME}',
      'echo $HOME',
      'cat < in.txt',
      'echo hi > out.txt',
      'foo &',
      'echo {a,b}',
      'sleep 1 &\nrm x',
    ];
    for (const c of dangerous) {
      expect(evalBash(c).sessionCacheable).toBe(false);
    }
  });

  test('interpreter / code-generator first words are NOT cacheable', () => {
    for (const c of ['python script.py', 'python3 -c print(1)', 'node app.js', 'bash x.sh',
      'sh x.sh', 'eval ls', 'env ls', 'xargs rm', 'find . -delete', 'awk "{print}"',
      'sed s/a/b/', '/usr/bin/python x.py']) {
      expect(evalBash(c).sessionCacheable).toBe(false);
    }
  });
});
