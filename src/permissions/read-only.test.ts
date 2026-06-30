import { describe, test, expect } from 'bun:test';
import { parseCommand } from './command-parser.js';
import { isReadOnly } from './read-only.js';

const ro = (cmd: string): boolean => {
  const p = parseCommand(cmd);
  if (p.unknown || p.segments.length !== 1) return false;
  return isReadOnly(p.segments[0]);
};

describe('isReadOnly — read-only commands', () => {
  test.each([
    'ls -la', 'pwd', 'echo hi', 'cat file.txt', 'head -n5 f', 'tail -f log', 'wc -l f',
    'grep -r pattern .', 'rg foo', 'stat f', 'date', 'whoami', 'find . -name "*.ts"',
    'git status', 'git log --oneline', 'git diff HEAD', 'npm ls', 'sort f', 'du -sh .',
  ])('%p is read-only', (cmd) => {
    expect(ro(cmd)).toBe(true);
  });
});

describe('isReadOnly — mutating / unsafe commands', () => {
  test.each([
    'rm -rf x', 'mv a b', 'cp a b', 'touch f', 'mkdir d', 'chmod +x f', 'ln -s a b',
    'python script.py', 'python3 -c print(1)', 'node app.js', 'sh x.sh', 'bash x.sh',
    'eval ls', 'xargs rm', 'awk "{print}"', 'sed s/a/b/', 'tr a b', 'tee out', 'dd if=/dev/zero',
    'git push', 'git commit -m x', 'npm install', 'find . -delete', 'find . -exec rm {} ;',
    'sort -o out f', 'echo hi > out', 'curl http://x', 'wget http://x', 'unknowncmd',
  ])('%p is NOT read-only', (cmd) => {
    expect(ro(cmd)).toBe(false);
  });
});
