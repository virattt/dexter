import { describe, test, expect } from 'bun:test';
import { parseCommand } from './command-parser.js';

const seg = (cmd: string) => {
  const p = parseCommand(cmd);
  return p;
};

describe('parseCommand — simple commands', () => {
  test('single command with args', () => {
    const p = parseCommand('ls -la /tmp');
    expect(p.unknown).toBe(false);
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0].base).toBe('ls');
    expect(p.segments[0].args).toEqual(['-la', '/tmp']);
    expect(p.segments[0].hasWriteRedirect).toBe(false);
  });

  test('path command resolves to basename', () => {
    expect(parseCommand('/usr/bin/rm -rf x').segments[0].base).toBe('rm');
  });

  test('leading env assignments are stripped', () => {
    const p = parseCommand('FOO=bar BAZ=qux rm -rf build');
    expect(p.segments[0].base).toBe('rm');
    expect(p.segments[0].env).toEqual(['FOO=bar', 'BAZ=qux']);
  });
});

describe('parseCommand — compound decomposition', () => {
  test.each([
    ['cat a && rm b', ['cat', 'rm']],
    ['cat a || rm b', ['cat', 'rm']],
    ['cat a | grep b', ['cat', 'grep']],
    ['a ; b', ['a', 'b']],
    ['a\nb', ['a', 'b']],
    ['sleep 1 & echo done', ['sleep', 'echo']],
    ['cat x && echo y | tee z ; rm w', ['cat', 'echo', 'tee', 'rm']],
  ])('decomposes %p', (cmd, bases) => {
    const p = parseCommand(cmd);
    expect(p.unknown).toBe(false);
    expect(p.segments.map((s) => s.base)).toEqual(bases);
  });
});

describe('parseCommand — safe wrappers are skipped', () => {
  test.each([
    ['time ls', 'ls'],
    ['nice -n 5 ls', 'ls'],
    ['nohup ls', 'ls'],
    ['env ls', 'ls'],
    ['env FOO=bar ls -la', 'ls'],
    ['timeout 5 ls', 'ls'],
    ['timeout 5s ls', 'ls'],
    ['command ls', 'ls'],
  ])('%p -> command %p', (cmd, base) => {
    expect(parseCommand(cmd).segments[0].base).toBe(base);
  });
});

describe('parseCommand — write redirects flagged', () => {
  test.each(['echo hi > out', 'echo hi >> out', 'echo hi 2> err', 'echo hi &> all'])(
    '%p has write redirect',
    (cmd) => {
      expect(parseCommand(cmd).segments[0].hasWriteRedirect).toBe(true);
    },
  );
  test('input redirect is not a write', () => {
    expect(parseCommand('cat < in.txt').segments[0].hasWriteRedirect).toBe(false);
  });
});

describe('parseCommand — FAIL CLOSED on dynamic / uninspectable constructs', () => {
  test.each([
    ['command substitution $()', 'echo $(whoami)'],
    ['backticks', 'echo `whoami`'],
    ['braced var', 'echo ${HOME}'],
    ['bare var', 'echo $HOME'],
    ['var in double quotes', 'cat "$(echo /etc/passwd)"'],
    ['bare var in double quotes', 'echo "$HOME"'],
    ['process substitution <()', 'diff <(a) <(b)'],
    ['process substitution >()', 'tee >(cat)'],
    ['here-document', 'cat <<EOF'],
    ['brace expansion', 'echo {a,b}'],
    ['subshell', '(cd /tmp && rm x)'],
    ['trailing comment', 'ls # sneaky'],
    ['unterminated single quote', "echo 'oops"],
    ['unterminated double quote', 'echo "oops'],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('%s -> unknown', (_label, cmd) => {
    const p = parseCommand(cmd);
    expect(p.unknown).toBe(true);
    expect(p.segments).toHaveLength(0);
  });
});

describe('parseCommand — quoted metacharacters are literal (NOT unknown, single segment)', () => {
  test.each([
    ["echo 'a|b'", 'echo', 'a|b'],
    ["echo 'a;b'", 'echo', 'a;b'],
    ["echo 'a && b'", 'echo', 'a && b'],
    ['echo "a;b"', 'echo', 'a;b'],
    ['echo "a&&b"', 'echo', 'a&&b'],
    ["grep '$x' file", 'grep', '$x'],
    ["grep 'pattern with $(stuff)' file", 'grep', 'pattern with $(stuff)'],
  ])('%p stays one segment', (cmd, base, firstArg) => {
    const p = parseCommand(cmd);
    expect(p.unknown).toBe(false);
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0].base).toBe(base);
    expect(p.segments[0].args[0]).toBe(firstArg);
  });
});

describe('parseCommand — fd redirects (2>&1) are not split or mis-lexed', () => {
  test('2>&1 stays one segment, no spurious "1" command, no false write flag', () => {
    const p = parseCommand('echo hi 2>&1');
    expect(p.unknown).toBe(false);
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0].base).toBe('echo');
    expect(p.segments[0].hasWriteRedirect).toBe(false); // fd-dup, not a file write
  });
  test('a real file redirect alongside 2>&1 is still flagged', () => {
    const p = parseCommand('echo hi > out 2>&1');
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0].base).toBe('echo');
    expect(p.segments[0].hasWriteRedirect).toBe(true);
  });
  test('2>&1 before && still exposes the real second command', () => {
    const p = parseCommand('grep x f 2>&1 && rm -rf /tmp/y');
    expect(p.segments.map((s) => s.base)).toEqual(['grep', 'rm']);
  });
});

describe('parseCommand — backslash-newline is line continuation (matches sh)', () => {
  test('r\\<newline>m collapses to rm', () => {
    expect(parseCommand('r\\\nm -rf x').segments[0].base).toBe('rm');
  });
});

describe('parseCommand — unquoted globs fail closed', () => {
  test.each(['cat *.txt', 'ls .env*', 'cat .ssh/*', 'rm file?', 'ls [abc]*'])('%p -> unknown', (cmd) => {
    expect(parseCommand(cmd).unknown).toBe(true);
  });
  test('quoted glob is literal (not a glob)', () => {
    expect(parseCommand('find . -name "*.ts"').unknown).toBe(false);
  });
});

describe('parseCommand — env stripped per segment in a compound', () => {
  test('FOO=bar before rm in a compound still exposes rm', () => {
    const p = parseCommand('echo ok && FOO=bar rm -rf /tmp/x');
    expect(p.unknown).toBe(false);
    expect(p.segments.map((s) => s.base)).toEqual(['echo', 'rm']);
    expect(p.segments[1].env).toEqual(['FOO=bar']);
  });
});
