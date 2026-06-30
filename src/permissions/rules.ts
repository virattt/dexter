/**
 * Bash permission rules: grammar, matching, persistence, and the built-in
 * security floor (env-injection + secret-read denials).
 *
 * Rule grammar mirrors Claude Code's `Tool(content)`:
 *   - `Bash(git status)`   exact: the whole command must equal `git status`
 *   - `Bash(rm -rf:*)`     prefix: command words start with `rm -rf`
 *   - `Bash`               tool-wide: any bash command
 * Escaping inside `(...)`: backslash first, then parens (`\\` `\(` `\)`).
 *
 * Rules are parsed to a structured form on load and serialized back from structure
 * (never by concatenating raw user input) so a crafted command can't inject a rule.
 */
import type { ParsedSegment } from './command-parser.js';
import { isReadOnly } from './read-only.js';
import { loadConfig, saveConfig } from '../utils/config.js';

export type Decision = 'allow' | 'ask' | 'deny';
export type RuleKind = 'allow' | 'ask' | 'deny';

export type ShellRule =
  | { kind: 'exact'; words: string[]; raw: string }
  | { kind: 'prefix'; words: string[]; raw: string }
  | { kind: 'toolwide'; raw: string };

export interface RuleSet {
  allow: ShellRule[];
  ask: ShellRule[];
  deny: ShellRule[];
  defaultBashDecision: Decision;
}

// ──────────────────────────────────────────────────────────────────────────
// Grammar
// ──────────────────────────────────────────────────────────────────────────

function unescape(content: string): string {
  return content.replace(/\\([\\()])/g, '$1');
}
function escape(content: string): string {
  return content.replace(/([\\()])/g, '\\$1');
}

/** Parse a rule string into a structured rule, or null if malformed. */
export function parseRule(input: string): ShellRule | null {
  const s = input.trim();
  if (s === 'Bash') return { kind: 'toolwide', raw: 'Bash' };
  const m = /^Bash\((.*)\)$/s.exec(s);
  if (!m) return null;
  const content = unescape(m[1]);
  if (content.endsWith(':*')) {
    const prefix = content.slice(0, -2).trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length === 0) return { kind: 'toolwide', raw: serializeRule({ kind: 'toolwide', raw: '' }) };
    return { kind: 'prefix', words, raw: s };
  }
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return { kind: 'exact', words, raw: s };
}

/** Serialize a structured rule back to its canonical string form. */
export function serializeRule(rule: ShellRule): string {
  if (rule.kind === 'toolwide') return 'Bash';
  if (rule.kind === 'prefix') return `Bash(${escape(rule.words.join(' '))}:*)`;
  return `Bash(${escape(rule.words.join(' '))})`;
}

function basename(word: string): string {
  const parts = word.split('/');
  return parts[parts.length - 1] || word;
}

/** The words a segment is matched against: [basename(command), ...args]. */
function segmentWords(seg: ParsedSegment): string[] {
  return [seg.base, ...seg.args];
}

/** True if a parsed segment matches a rule (whitespace-sensitive, basename-aware). */
export function matchSegment(seg: ParsedSegment, rule: ShellRule): boolean {
  if (rule.kind === 'toolwide') return true;
  const segW = segmentWords(seg);
  const ruleW = [...rule.words];
  // Compare the command word by basename so /usr/bin/rm matches a `rm` rule.
  const ruleFirst = basename(ruleW[0]);
  if (segW.length === 0) return false;
  if (ruleFirst !== segW[0]) return false;
  if (rule.kind === 'exact') {
    if (segW.length !== ruleW.length) return false;
    for (let i = 1; i < ruleW.length; i++) if (ruleW[i] !== segW[i]) return false;
    return true;
  }
  // prefix: segment words must start with the rule words (after the basename first word).
  if (segW.length < ruleW.length) return false;
  for (let i = 1; i < ruleW.length; i++) if (ruleW[i] !== segW[i]) return false;
  return true;
}

/** First rule in the list that matches the segment, if any. */
export function matchRuleSet(seg: ParsedSegment, rules: ShellRule[]): ShellRule | undefined {
  return rules.find((r) => matchSegment(seg, r));
}

// ──────────────────────────────────────────────────────────────────────────
// Built-in security floor (not user-overridable)
// ──────────────────────────────────────────────────────────────────────────

/** Environment assignments that can inject code or hijack command resolution. */
const DANGEROUS_ENV = /^(LD_PRELOAD|LD_LIBRARY_PATH|DYLD_[A-Z_]+|PATH|IFS|BASH_ENV|ENV|SHELLOPTS|PERL5LIB|PYTHONPATH|NODE_OPTIONS|GIT_SSH(_COMMAND)?)=/;

/**
 * Paths whose contents are secret. Matched against command args (case-insensitive;
 * `.env` matches any number of dotted suffixes; the glob fail-closed in the parser
 * covers `*`-expanded forms so these only need to catch literal paths).
 */
const SECRET_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i, // .env, .env.local, .env.production.local
  /(^|\/)\.envrc$/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.gnupg(\/|$)/i,
  /(^|\/)id_(rsa|ed25519|ecdsa|dsa)\b/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.key$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)credentials(\.[\w-]+)?($|\/)/i, // credentials, credentials.yml, credentials/
  /\.dexter\/credentials/i,
];

/** Expand a word into the strings to test: the whole word plus any `--opt=VALUE` value. */
function secretCandidates(word: string): string[] {
  const eq = word.indexOf('=');
  return eq >= 0 ? [word, word.slice(eq + 1)] : [word];
}

/**
 * The hard security floor: deny env-injection assignments and reads of secret
 * paths, regardless of user rules. Conservative pre-sandbox protection.
 */
export function builtinDeny(seg: ParsedSegment): { denied: boolean; reason?: string } {
  if (seg.env.some((e) => DANGEROUS_ENV.test(e))) {
    return { denied: true, reason: 'sets a sensitive environment variable (possible code/PATH injection)' };
  }
  const candidates = [seg.command, ...seg.args].flatMap(secretCandidates);
  if (candidates.some((w) => SECRET_PATTERNS.some((re) => re.test(w)))) {
    return { denied: true, reason: 'references a sensitive/secret path' };
  }
  return { denied: false };
}

// ──────────────────────────────────────────────────────────────────────────
// proposeRule (for the "always allow" option)
// ──────────────────────────────────────────────────────────────────────────

/** Commands whose first arg is a subcommand worth scoping a prefix rule to. */
const SUBCOMMAND_COMMANDS = new Set(['git', 'npm', 'pnpm', 'yarn', 'bun', 'docker', 'cargo', 'go', 'kubectl', 'gh', 'pip', 'pip3']);

/**
 * A conservative rule string to offer for "always allow". Never tool-wide.
 *
 * Only read-only commands get a wildcard prefix (`Bash(ls:*)`). A mutating command
 * gets the EXACT command (`Bash(rm important.txt)`), so approving one benign
 * invocation can never auto-allow a destructive sibling like `rm -rf /`.
 */
export function proposeRule(seg: ParsedSegment): string {
  const words = [seg.base, ...seg.args];
  if (!isReadOnly(seg)) {
    return serializeRule({ kind: 'exact', words, raw: '' });
  }
  if (SUBCOMMAND_COMMANDS.has(seg.base)) {
    const sub = seg.args.find((a) => !a.startsWith('-'));
    if (sub) {
      return serializeRule({ kind: 'prefix', words: [seg.base, sub], raw: '' });
    }
  }
  return serializeRule({ kind: 'prefix', words: [seg.base], raw: '' });
}

// ──────────────────────────────────────────────────────────────────────────
// Persistence (.dexter/settings.json → permissions)
// ──────────────────────────────────────────────────────────────────────────

function parseList(list: string[] | undefined): ShellRule[] {
  if (!list) return [];
  const out: ShellRule[] = [];
  for (const s of list) {
    const r = parseRule(s);
    if (r) out.push(r);
  }
  return out;
}

/** Load the bash rule set from `.dexter/settings.json`. */
export function loadRuleSet(): RuleSet {
  const config = loadConfig();
  const p = config.permissions ?? {};
  const def = p.defaultBashDecision;
  return {
    allow: parseList(p.allow),
    ask: parseList(p.ask),
    deny: parseList(p.deny),
    defaultBashDecision: def === 'allow' || def === 'deny' ? def : 'ask',
  };
}

/** Append a rule string to `permissions.<kind>` (deduped) and persist. */
export function addRule(kind: RuleKind, ruleString: string): boolean {
  const config = loadConfig();
  const permissions = config.permissions ?? {};
  const list = permissions[kind] ?? [];
  if (!list.includes(ruleString)) {
    list.push(ruleString);
  }
  permissions[kind] = list;
  config.permissions = permissions;
  return saveConfig(config);
}
