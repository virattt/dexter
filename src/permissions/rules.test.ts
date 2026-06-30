import { describe, test, expect } from 'bun:test';
import { parseCommand, type ParsedSegment } from './command-parser.js';
import { parseRule, serializeRule, matchSegment, builtinDeny, proposeRule } from './rules.js';

const seg1 = (cmd: string): ParsedSegment => {
  const p = parseCommand(cmd);
  if (p.unknown || p.segments.length === 0) throw new Error(`unparseable: ${cmd}`);
  return p.segments[0];
};

describe('parseRule / serializeRule round-trip', () => {
  test.each([
    'Bash',
    'Bash(git status)',
    'Bash(rm -rf:*)',
    'Bash(ls:*)',
    'Bash(npm run test:*)',
  ])('%p round-trips', (s) => {
    const r = parseRule(s);
    expect(r).not.toBeNull();
    expect(serializeRule(r!)).toBe(s);
  });

  test('escaped parens round-trip losslessly', () => {
    const r = parseRule('Bash(echo \\(hi\\))');
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('exact');
    expect(serializeRule(r!)).toBe('Bash(echo \\(hi\\))');
  });

  test('malformed rules return null', () => {
    expect(parseRule('git status')).toBeNull();
    expect(parseRule('Bash(')).toBeNull();
  });
});

describe('matchSegment', () => {
  test('prefix matches by leading words; respects word boundaries', () => {
    const rule = parseRule('Bash(rm:*)')!;
    expect(matchSegment(seg1('rm -rf x'), rule)).toBe(true);
    expect(matchSegment(seg1('rm'), rule)).toBe(true);
    expect(matchSegment(seg1('rmdir x'), rule)).toBe(false); // rmdir != rm
  });

  test('exact requires the whole command to match', () => {
    const rule = parseRule('Bash(git status)')!;
    expect(matchSegment(seg1('git status'), rule)).toBe(true);
    expect(matchSegment(seg1('git status -s'), rule)).toBe(false);
    expect(matchSegment(seg1('git log'), rule)).toBe(false);
  });

  test('multi-word prefix', () => {
    const rule = parseRule('Bash(git push:*)')!;
    expect(matchSegment(seg1('git push origin main'), rule)).toBe(true);
    expect(matchSegment(seg1('git pull'), rule)).toBe(false);
  });

  test('command matched by basename', () => {
    const rule = parseRule('Bash(rm:*)')!;
    expect(matchSegment(seg1('/usr/bin/rm -rf x'), rule)).toBe(true);
  });

  test('tool-wide matches anything', () => {
    const rule = parseRule('Bash')!;
    expect(matchSegment(seg1('anything goes here'), rule)).toBe(true);
  });
});

describe('builtinDeny — security floor', () => {
  test.each([
    'LD_PRELOAD=evil.so ls',
    'LD_LIBRARY_PATH=/tmp ls',
    'PATH=/tmp:/bin ls',
    'env LD_PRELOAD=evil.so ls', // #1: env wrapper must not hide the injection
    'timeout 5 env DYLD_INSERT_LIBRARIES=x ls',
    'cat .env',
    'cat config/.env.local',
    'cat .env.production.local', // #2: multi-dot env file
    'cat ~/.ssh/id_rsa',
    'cp ~/.aws/credentials /tmp/x',
    'grep secret ~/.ssh/config',
    'cat private.pem',
    'head key.PEM', // #2: case-insensitive extension
    'cat config/credentials.yml',
    'cat .envrc',
    'cat --file=.env', // #7: --opt=PATH form
  ])('%p is denied', (cmd) => {
    expect(builtinDeny(seg1(cmd)).denied).toBe(true);
  });

  test.each(['ls -la', 'cat README.md', 'FOO=bar ls', 'git status', 'echo hi'])(
    '%p is not denied',
    (cmd) => {
      expect(builtinDeny(seg1(cmd)).denied).toBe(false);
    },
  );
});

describe('proposeRule', () => {
  test('read-only command → prefix wildcard', () => {
    expect(proposeRule(seg1('ls -la'))).toBe('Bash(ls:*)');
    expect(proposeRule(seg1('cat foo.txt'))).toBe('Bash(cat:*)');
  });
  test('read-only subcommand → prefix on cmd+subcommand', () => {
    expect(proposeRule(seg1('git status -s'))).toBe('Bash(git status:*)');
  });
  test('mutating command → EXACT rule (never a wildcard that could auto-allow siblings)', () => {
    // #3: `rm important.txt` must NOT propose Bash(rm:*) (which would auto-allow rm -rf /).
    expect(proposeRule(seg1('rm important.txt'))).toBe('Bash(rm important.txt)');
    expect(proposeRule(seg1('rm -rf build'))).toBe('Bash(rm -rf build)');
    expect(proposeRule(seg1('git push origin main'))).toBe('Bash(git push origin main)');
    expect(proposeRule(seg1('npm run build'))).toBe('Bash(npm run build)');
  });
});
