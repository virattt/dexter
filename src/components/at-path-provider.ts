/**
 * AtPathAutocompleteProvider
 *
 * Wraps pi-tui's CombinedAutocompleteProvider and adds a readdirSync-based
 * fallback for `@`-triggered path completion.
 *
 * Behaviour:
 *  - Slash commands (/model, /sessions, etc.) — handled by the inner provider
 *  - `@path` with `fd` installed — fuzzy file search via the inner provider
 *  - `@path` without `fd`          — prefix-filtered directory listing via readdirSync
 */
import {
  CombinedAutocompleteProvider,
  type AutocompleteItem,
  type AutocompleteProvider,
  type SlashCommand,
} from '@mariozechner/pi-tui';
import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const AT_DELIMITERS = new Set([' ', '\t', '"', "'", '=']);

/**
 * Returns the `@…` token that starts at the last delimiter boundary before the
 * cursor, or `null` if no such token exists.
 */
export function extractAtPrefix(textBeforeCursor: string): string | null {
  let tokenStart = 0;
  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    if (AT_DELIMITERS.has(textBeforeCursor[i]!)) {
      tokenStart = i + 1;
      break;
    }
  }
  return textBeforeCursor[tokenStart] === '@' ? textBeforeCursor.slice(tokenStart) : null;
}

/**
 * Returns file/directory suggestions for a given `@rawPath` prefix using
 * `readdirSync` — no external tools required.
 */
export function getAtFileSuggestions(atPrefix: string, cwd: string): AutocompleteItem[] {
  const rawPath = atPrefix.slice(1); // strip leading @

  try {
    let searchDir: string;
    let filePrefix: string;

    if (rawPath === '') {
      searchDir = cwd;
      filePrefix = '';
    } else if (rawPath.endsWith('/')) {
      searchDir = join(cwd, rawPath);
      filePrefix = '';
    } else {
      const dir = dirname(rawPath);
      searchDir = dir === '.' ? cwd : join(cwd, dir);
      filePrefix = basename(rawPath);
    }

    const entries = readdirSync(searchDir, { withFileTypes: true }).filter(
      (e) =>
        e.name.toLowerCase().startsWith(filePrefix.toLowerCase()) &&
        (!e.name.startsWith('.') || filePrefix.startsWith('.')),
    );

    const suggestions: AutocompleteItem[] = entries.map((e) => {
      let isDir = e.isDirectory();
      if (!isDir && e.isSymbolicLink()) {
        try {
          isDir = statSync(join(searchDir, e.name)).isDirectory();
        } catch {
          /* broken symlink — treat as file */
        }
      }

      const rel =
        rawPath.includes('/') ? join(dirname(rawPath), e.name) : e.name;
      const completionPath = isDir ? `${rel}/` : rel;

      return {
        value: `@${completionPath}`,
        label: e.name + (isDir ? '/' : ''),
        description: completionPath,
      };
    });

    // Directories first, then alphabetical.
    suggestions.sort((a, b) => {
      const aDir = a.label.endsWith('/');
      const bDir = b.label.endsWith('/');
      if (aDir && !bDir) return -1;
      if (!aDir && bDir) return 1;
      return a.label.localeCompare(b.label);
    });

    return suggestions.slice(0, 20);
  } catch {
    return [];
  }
}

export class AtPathAutocompleteProvider implements AutocompleteProvider {
  private readonly inner: CombinedAutocompleteProvider;
  private readonly cwd: string;
  private readonly commands: SlashCommand[];

  constructor(commands: SlashCommand[], cwd: string, _fdPath: string | null) {
    this.commands = commands;
    // Always pass null to prevent CombinedAutocompleteProvider from calling
    // spawnSync(fdPath, ...) on every @ keystroke, which blocks the event loop.
    // Our own getAtFileSuggestions() handles @ paths via readdirSync instead.
    this.inner = new CombinedAutocompleteProvider(commands, cwd, null);
    this.cwd = cwd;
  }

  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
  ): { items: AutocompleteItem[]; prefix: string } | null {
    const currentLine = lines[cursorLine] ?? '';
    const textBeforeCursor = currentLine.slice(0, cursorCol);

    // When the user has typed a complete slash command name (exact match, no
    // trailing space), suppress autocomplete so Enter submits directly instead
    // of selecting the completion item and requiring a second Enter.
    if (textBeforeCursor.startsWith('/') && !textBeforeCursor.includes(' ')) {
      const typedName = textBeforeCursor.slice(1).toLowerCase();
      const isExactMatch = this.commands.some(
        (cmd) => cmd.name.toLowerCase() === typedName,
      );
      if (isExactMatch) return null;
    }

    // Slash commands + fd-based fuzzy @ completion (fd disabled — null above).
    const result = this.inner.getSuggestions(lines, cursorLine, cursorCol);
    if (result !== null) return result;

    // Fallback: readdirSync-based @ completion (works without fd).
    const atPrefix = extractAtPrefix(textBeforeCursor);
    if (atPrefix === null) return null;

    const suggestions = getAtFileSuggestions(atPrefix, this.cwd);
    if (suggestions.length === 0) return null;

    return { items: suggestions, prefix: atPrefix };
  }

  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItem,
    prefix: string,
  ) {
    // Delegate to inner provider — it already handles @-prefix insertion correctly.
    return this.inner.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
  }
}
