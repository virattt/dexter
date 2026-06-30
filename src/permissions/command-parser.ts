/**
 * Fail-closed shell command parser (the permission system's security keystone).
 *
 * Decomposes a `/bin/sh -c` command string into independent segments so each can
 * be classified and rule-matched. It is intentionally conservative: anything it
 * cannot analyze with confidence is marked `unknown`, which the engine treats as
 * "never auto-allow" (fall back to asking the human).
 *
 * Quote semantics (POSIX sh):
 *  - Inside single quotes everything is literal.
 *  - Inside double quotes the operators (`| ; & < > ( )`) are literal, but `$` and
 *    backtick STILL expand — so a `$`/backtick inside double quotes is dynamic.
 *  - A backslash escapes the next character (outside single quotes).
 *
 * We DO NOT execute or expand anything. We only need enough structure to answer
 * "what is the command word of each segment, does it write, and is there any
 * dynamic/uninspectable construct".
 *
 * Vendored deliberately (no `shell-quote` dependency): we control exactly what is
 * and isn't accepted, and unknown syntax fails closed.
 */

export interface ParsedSegment {
  /** Command word as written (may be a path like /usr/bin/rm). */
  command: string;
  /** Basename of the command word (rm for /usr/bin/rm). */
  base: string;
  /** Argument words following the command (env assignments + wrappers stripped). */
  args: string[];
  /** Leading `VAR=value` assignments that preceded the command word. */
  env: string[];
  /** True if the segment contains a write redirect (`>`, `>>`, `2>`, `&>`). */
  hasWriteRedirect: boolean;
  /** The raw segment text (trimmed). */
  raw: string;
}

export interface ParsedCommand {
  segments: ParsedSegment[];
  /** True if the command contained a construct we cannot safely analyze. */
  unknown: boolean;
  /** Human-readable reason for `unknown` (for prompts / debugging). */
  reason?: string;
}

type TokenKind = 'word' | 'op';
interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * Wrappers that prefix a real command (the wrapped command is what actually runs,
 * so we skip the wrapper and its option args to reach it). Note: `exec`, `sh`,
 * interpreters, etc. are deliberately NOT here — they should surface as the command
 * word so the classifier marks them non-read-only.
 */
const WRAPPERS = new Set([
  'time', 'nice', 'nohup', 'command', 'builtin', 'env', 'timeout', 'stdbuf', 'ionice', 'setsid',
]);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
/** Option / numeric / duration / env tokens that a wrapper consumes before its command. */
const WRAPPER_ARG = /^-|^\d+[smhd]?$/;

/**
 * Lex a command string into words and operator tokens, failing closed on any
 * dynamic or uninspectable construct.
 */
function lex(input: string): { tokens: Token[]; unknown: boolean; reason?: string } {
  const tokens: Token[] = [];
  let cur = '';
  let curStarted = false; // distinguishes an empty word ("") from no word
  let unknown = false;
  let reason: string | undefined;

  const flush = () => {
    if (curStarted) {
      tokens.push({ kind: 'word', text: cur });
    }
    cur = '';
    curStarted = false;
  };
  const fail = (r: string) => {
    if (!unknown) {
      unknown = true;
      reason = r;
    }
  };
  const op = (text: string) => {
    flush();
    tokens.push({ kind: 'op', text });
  };

  const s = input;
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    // Single quote: literal run until the next single quote.
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end === -1) {
        fail('unterminated single quote');
        break;
      }
      cur += s.slice(i + 1, end);
      curStarted = true;
      i = end + 1;
      continue;
    }

    // Double quote: literal grouping, but $ and backtick still expand.
    if (c === '"') {
      let j = i + 1;
      let closed = false;
      while (j < s.length) {
        const d = s[j];
        if (d === '\\') {
          if (s[j + 1] === '\n') {
            j += 2; // line continuation: both characters vanish
            continue;
          }
          // In double quotes, backslash escapes only $ ` " \ ; otherwise literal.
          cur += s[j + 1] ?? '';
          curStarted = true;
          j += 2;
          continue;
        }
        if (d === '"') {
          closed = true;
          j += 1;
          break;
        }
        if (d === '$' || d === '`') {
          fail('variable or command substitution');
          j += 1;
          continue;
        }
        cur += d;
        curStarted = true;
        j += 1;
      }
      if (!closed) {
        fail('unterminated double quote');
        break;
      }
      i = j;
      continue;
    }

    // Backslash escape (outside quotes): next char is literal.
    if (c === '\\') {
      if (s[i + 1] === '\n') {
        i += 2; // line continuation: backslash + newline both vanish (matches sh)
        continue;
      }
      if (i + 1 < s.length) {
        cur += s[i + 1];
        curStarted = true;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    // Dynamic expansion → fail closed.
    if (c === '$' || c === '`') {
      fail('variable or command substitution');
      i += 1;
      continue;
    }

    // Process substitution / subshell / grouping → fail closed.
    if (c === '(' || c === ')') {
      fail('subshell or grouping');
      i += 1;
      continue;
    }
    if (c === '{' || c === '}') {
      fail('brace expansion');
      i += 1;
      continue;
    }

    // Comment: the rest of the line is ignored by the shell. We can't be sure of
    // intent, so fail closed rather than silently dropping text.
    if (c === '#' && !curStarted) {
      fail('comment');
      break;
    }

    // Operators (unquoted).
    if (c === '|') {
      if (s[i + 1] === '|') {
        op('||');
        i += 2;
      } else {
        op('|');
        i += 1;
      }
      continue;
    }
    if (c === '&') {
      if (s[i + 1] === '&') {
        op('&&');
        i += 2;
      } else if (s[i + 1] === '>') {
        // &> / &>> : redirect both stdout+stderr to a file (a write).
        flush();
        i += 2;
        if (s[i] === '>') i += 1;
        tokens.push({ kind: 'op', text: '&>' });
      } else {
        op('&');
        i += 1;
      }
      continue;
    }
    if (c === ';') {
      op(';');
      i += 1;
      continue;
    }
    if (c === '\n') {
      op(';');
      i += 1;
      continue;
    }
    if (c === '>') {
      // A bare leading fd number (the `2` in `2>`) is part of the redirect, not a word.
      if (curStarted && /^\d+$/.test(cur)) {
        cur = '';
        curStarted = false;
      } else {
        flush();
      }
      let text = '>';
      i += 1;
      if (s[i] === '>') {
        text = '>>';
        i += 1;
      }
      // fd-duplication (`>&1`, `>&-`): redirects a descriptor, not a file write.
      if (s[i] === '&' && /[0-9-]/.test(s[i + 1] ?? '')) {
        i += 1;
        while (i < s.length && /[0-9-]/.test(s[i])) i += 1;
        continue;
      }
      tokens.push({ kind: 'op', text });
      continue;
    }
    if (c === '<') {
      if (s[i + 1] === '<') {
        fail('here-document');
        i += 2;
        continue;
      }
      if (s[i + 1] === '(') {
        fail('process substitution');
        i += 2;
        continue;
      }
      if (curStarted && /^\d+$/.test(cur)) {
        cur = '';
        curStarted = false;
      } else {
        flush();
      }
      i += 1;
      // fd-duplication (`<&3`): not a write.
      if (s[i] === '&' && /[0-9-]/.test(s[i + 1] ?? '')) {
        i += 1;
        while (i < s.length && /[0-9-]/.test(s[i])) i += 1;
        continue;
      }
      tokens.push({ kind: 'op', text: '<' });
      continue;
    }

    // Glob metacharacters expand to filenames we cannot inspect → fail closed.
    if (c === '*' || c === '?' || c === '[') {
      fail('glob pattern');
      i += 1;
      continue;
    }

    // Whitespace separates words.
    if (c === ' ' || c === '\t') {
      flush();
      i += 1;
      continue;
    }

    // Ordinary character.
    cur += c;
    curStarted = true;
    i += 1;
  }
  flush();

  return { tokens, unknown, reason };
}

/** Group a flat token stream into command segments split on `&& || | ; &`. */
function splitSegments(tokens: Token[]): Token[][] {
  const segments: Token[][] = [];
  let current: Token[] = [];
  for (const t of tokens) {
    if (t.kind === 'op' && (t.text === '&&' || t.text === '||' || t.text === '|' || t.text === ';' || t.text === '&')) {
      segments.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }
  segments.push(current);
  return segments.filter((seg) => seg.length > 0);
}

/** Build a ParsedSegment from a segment's tokens (strips env + safe wrappers). */
function buildSegment(tokens: Token[]): ParsedSegment {
  const env: string[] = [];
  let hasWriteRedirect = false;
  const words: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'op') {
      if (t.text === '>' || t.text === '>>' || t.text === '&>') {
        hasWriteRedirect = true;
        // Skip the redirect target word, if present.
        if (tokens[i + 1]?.kind === 'word') i += 1;
      } else if (t.text === '<') {
        // Input redirect: skip its target (not a write).
        if (tokens[i + 1]?.kind === 'word') i += 1;
      }
      continue;
    }
    words.push(t.text);
  }

  // Strip leading `VAR=value` env assignments.
  let idx = 0;
  while (idx < words.length && ENV_ASSIGNMENT.test(words[idx])) {
    env.push(words[idx]);
    idx += 1;
  }

  // Skip wrappers and their option args to reach the real command. Wrappers can
  // stack (e.g. `time nice -n 5 cmd`). The consume rule only eats option-like
  // tokens (`-flag`, numbers, durations, VAR=val) — never a bare command word — so
  // the wrapped command is always reached and can never be hidden.
  for (;;) {
    const w = words[idx];
    if (w === undefined) break;
    if (!WRAPPERS.has(basename(w))) break;
    idx += 1;
    while (idx < words.length && (WRAPPER_ARG.test(words[idx]) || ENV_ASSIGNMENT.test(words[idx]))) {
      // Keep env assignments visible to the deny floor: `env LD_PRELOAD=x ls` must
      // not hide LD_PRELOAD just because it followed the `env` wrapper.
      if (ENV_ASSIGNMENT.test(words[idx])) env.push(words[idx]);
      idx += 1;
    }
  }

  const command = words[idx] ?? '';
  const args = words.slice(idx + 1);
  return {
    command,
    base: basename(command),
    args,
    env,
    hasWriteRedirect,
    raw: '',
  };
}

function basename(word: string): string {
  if (!word) return word;
  const parts = word.split('/');
  return parts[parts.length - 1] || word;
}

/**
 * Parse a shell command into segments, failing closed on anything dynamic.
 */
export function parseCommand(command: string): ParsedCommand {
  const { tokens, unknown, reason } = lex(command);
  if (unknown) {
    return { segments: [], unknown: true, reason };
  }
  const segmentTokens = splitSegments(tokens);
  const segments = segmentTokens.map(buildSegment).filter((seg) => seg.command !== '');
  if (segments.length === 0) {
    // Empty (e.g. whitespace only) — treat as unknown so it can't auto-allow.
    return { segments: [], unknown: true, reason: 'empty command' };
  }
  return { segments, unknown: false };
}
