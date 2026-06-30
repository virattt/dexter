/**
 * Permission engine — decides allow / ask / deny for a tool call.
 *
 *   - write_file / edit_file → ask (legacy parity)
 *   - bash                   → parse → classify → match rules (this file's core)
 *   - everything else        → allow
 *
 * Bash matching contract (Phase 2; no OS sandbox yet, so read-only does NOT
 * auto-allow — that arrives in Phase 3):
 *   1. parser fails closed → ask (never cacheable)
 *   2. built-in security floor (env injection / secret reads) → deny
 *   3. any segment matches a user deny rule → deny
 *   4. any segment matches an ask rule → ask
 *   5. EVERY segment matches an allow rule → allow
 *   6. else → defaultBashDecision (ask). Read-only is classified + shown but does
 *      not auto-allow.
 */
import type { Classification, PermissionDecision, PermissionRequest } from './types.js';
import { parseCommand, type ParsedCommand } from './command-parser.js';
import { isReadOnly } from './read-only.js';
import { builtinDeny, loadRuleSet, matchRuleSet, proposeRule, serializeRule, type RuleSet } from './rules.js';

/** Tools that have always required explicit user approval before running. */
const LEGACY_APPROVAL_TOOLS = new Set<string>(['write_file', 'edit_file']);

/**
 * Shared session-approval key for the file-writing tools, preserving the legacy
 * behavior where approving one of write_file/edit_file covers the other.
 */
const FILE_WRITE_SESSION_KEY = 'file:write';

function classify(parsed: ParsedCommand): Classification {
  if (parsed.unknown) return 'unknown';
  return parsed.segments.every(isReadOnly) ? 'read-only' : 'mutating';
}

/** Pure bash decision with an injectable rule set (defaults to disk). Exported for tests. */
export function evaluateBash(command: string, rules: RuleSet = loadRuleSet()): PermissionDecision {
  const parsed = parseCommand(command);

  // 1. Fail closed — can't analyze, so ask and never cache.
  if (parsed.unknown) {
    return {
      mode: 'ask',
      reason: `Command needs review (${parsed.reason ?? 'complex syntax'}).`,
      command,
      classification: 'unknown',
      sessionCacheable: false,
    };
  }

  const classification = classify(parsed);
  // Only offer "always allow" for a single, fully-understood command.
  const proposedRule = parsed.segments.length === 1 ? proposeRule(parsed.segments[0]) : undefined;

  // 2. Built-in security floor (not user-overridable).
  for (const seg of parsed.segments) {
    const floor = builtinDeny(seg);
    if (floor.denied) {
      return { mode: 'deny', reason: floor.reason ?? 'Denied by policy.', command, classification, matchedRule: '(built-in)' };
    }
  }

  // 3. User deny rules — any matching segment blocks the whole command.
  for (const seg of parsed.segments) {
    const rule = matchRuleSet(seg, rules.deny);
    if (rule) {
      return { mode: 'deny', reason: 'Denied by a rule.', command, classification, matchedRule: serializeRule(rule) };
    }
  }

  // 4. Ask rules — any matching segment forces a prompt.
  for (const seg of parsed.segments) {
    const rule = matchRuleSet(seg, rules.ask);
    if (rule) {
      return { mode: 'ask', reason: 'Matches an ask rule.', command, classification, matchedRule: serializeRule(rule), proposedRule, sessionCacheable: true };
    }
  }

  // 5. Allow only if EVERY segment is independently allowed. A segment with a
  // write redirect can never be auto-allowed by a word-based rule (the rule can't
  // express the redirect target), so it forces a prompt.
  const allowMatches = parsed.segments.map((seg) =>
    seg.hasWriteRedirect ? undefined : matchRuleSet(seg, rules.allow),
  );
  if (allowMatches.every((m) => m !== undefined)) {
    return { mode: 'allow', reason: 'Matches an allow rule.', command, classification, matchedRule: serializeRule(allowMatches[0]!) };
  }

  // 6. Default. Read-only is recognized but does NOT auto-allow this phase.
  return {
    mode: rules.defaultBashDecision,
    reason:
      classification === 'read-only'
        ? 'Read-only command (still asks until the sandbox lands).'
        : 'No matching rule.',
    command,
    classification,
    proposedRule,
    sessionCacheable: true,
  };
}

/**
 * Evaluate whether a tool call may proceed.
 */
export function evaluatePermission(req: PermissionRequest): PermissionDecision {
  if (req.tool === 'bash') {
    const command = typeof req.args.command === 'string' ? req.args.command : '';
    return evaluateBash(command);
  }
  if (LEGACY_APPROVAL_TOOLS.has(req.tool)) {
    return { mode: 'ask', reason: 'This tool modifies files and needs your approval.' };
  }
  return { mode: 'allow', reason: 'Auto-approved.' };
}

/**
 * The key under which an `allow-session` grant is remembered. Approving the same
 * key again within the session skips the prompt.
 *
 * Legacy file-write tools share one key. Bash keys on the **exact command** so an
 * `allow-session` grant never extends to a different command — even one that shares
 * a broad ask rule (e.g. approving `git status` must not also pass `git push --force`).
 * Keeps the `bash:` prefix so the controller can prune bash grants per query.
 */
export function sessionKey(tool: string, decision: PermissionDecision): string {
  if (LEGACY_APPROVAL_TOOLS.has(tool)) {
    return FILE_WRITE_SESSION_KEY;
  }
  if (tool === 'bash') {
    return `bash:${(decision.command ?? '').trim()}`;
  }
  return tool;
}
