/**
 * Read-only command classifier.
 *
 * Decides whether a single parsed segment only reads (no filesystem/network
 * mutation). Conservative by design: a command is read-only ONLY if it is on the
 * allowlist, its flags are safe, it has no write redirect, and it is not in the
 * generator/interpreter denylist. Everything else is treated as mutating.
 *
 * In Phase 2 this drives `classification` (shown in the prompt) and `proposeRule`,
 * but NOT auto-allow — read-only auto-allow is gated on the OS sandbox (Phase 3).
 */
import type { ParsedSegment } from './command-parser.js';

/**
 * Commands that are never read-only regardless of flags: interpreters and code
 * generators (they can run/emit arbitrary commands), and in-place / writing tools.
 */
const NEVER_READ_ONLY = new Set<string>([
  'python', 'python3', 'node', 'bun', 'ruby', 'perl', 'php',
  'sh', 'bash', 'zsh', 'ksh', 'fish', 'dash',
  'eval', 'exec', 'source', '.',
  'xargs', 'awk', 'sed', 'tr', 'tee', 'dd',
]);

type FlagCheck = (args: string[]) => boolean;
const ALWAYS: FlagCheck = () => true;

/** Read-only unless one of the given (write-causing) flags appears. */
const safeUnless = (writeFlags: string[]): FlagCheck => {
  const set = new Set(writeFlags);
  return (args) => !args.some((a) => set.has(a) || (a.startsWith('--') && set.has(a)));
};

const GIT_READONLY_SUBCMDS = new Set([
  'status', 'log', 'diff', 'show', 'rev-parse', 'describe', 'blame', 'shortlog',
  'reflog', 'ls-files', 'ls-tree', 'cat-file', 'whatchanged', 'grep', 'rev-list', 'name-rev',
]);
const gitReadOnly: FlagCheck = (args) => {
  const sub = args.find((a) => !a.startsWith('-'));
  return sub !== undefined && GIT_READONLY_SUBCMDS.has(sub);
};

const NPM_READONLY_SUBCMDS = new Set(['ls', 'list', 'view', 'info', 'outdated', 'ping', 'whoami', 'root', 'prefix', 'bin']);
const npmReadOnly: FlagCheck = (args) => {
  const sub = args.find((a) => !a.startsWith('-'));
  return sub !== undefined && NPM_READONLY_SUBCMDS.has(sub);
};

const FIND_WRITE_FLAGS = new Set(['-exec', '-execdir', '-delete', '-ok', '-okdir', '-fprint', '-fprintf', '-fls']);
const findReadOnly: FlagCheck = (args) => !args.some((a) => FIND_WRITE_FLAGS.has(a));

/** Allowlist of read-only commands with a per-command flag safety check. */
const READ_ONLY: Record<string, FlagCheck> = {
  ls: ALWAYS, pwd: ALWAYS, echo: ALWAYS, printf: ALWAYS, cat: ALWAYS, head: ALWAYS, tail: ALWAYS,
  wc: ALWAYS, stat: ALWAYS, date: ALWAYS, whoami: ALWAYS, hostname: ALWAYS, uname: ALWAYS,
  id: ALWAYS, groups: ALWAYS, basename: ALWAYS, dirname: ALWAYS, realpath: ALWAYS, readlink: ALWAYS,
  printenv: ALWAYS, file: ALWAYS, cksum: ALWAYS, md5sum: ALWAYS, sha1sum: ALWAYS, sha256sum: ALWAYS,
  cut: ALWAYS, uniq: ALWAYS, comm: ALWAYS, column: ALWAYS, diff: ALWAYS, cmp: ALWAYS,
  df: ALWAYS, du: ALWAYS, ps: ALWAYS, uptime: ALWAYS, free: ALWAYS, env: ALWAYS,
  which: ALWAYS, type: ALWAYS, tree: ALWAYS, jq: ALWAYS, yq: ALWAYS,
  grep: ALWAYS, egrep: ALWAYS, fgrep: ALWAYS, rg: ALWAYS, ag: ALWAYS,
  sort: safeUnless(['-o', '--output']),
  git: gitReadOnly,
  npm: npmReadOnly,
  find: findReadOnly,
};

/** True if the segment is read-only (no mutation). Conservative / fail-closed. */
export function isReadOnly(seg: ParsedSegment): boolean {
  if (seg.hasWriteRedirect) return false;
  if (NEVER_READ_ONLY.has(seg.base)) return false;
  const check = READ_ONLY[seg.base];
  if (!check) return false; // not on the allowlist → treat as mutating
  return check(seg.args);
}
