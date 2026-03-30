import { describe, test, expect } from 'bun:test';
import {
  detectLineEnding,
  normalizeToLF,
  restoreLineEndings,
  normalizeForFuzzyMatch,
  fuzzyFindText,
  stripBom,
  generateDiffString,
} from './edit-diff.js';

describe('detectLineEnding', () => {
  test('returns \\n for Unix line endings', () => {
    expect(detectLineEnding('line1\nline2\nline3')).toBe('\n');
  });

  test('returns \\r\\n when CRLF appears before LF', () => {
    expect(detectLineEnding('line1\r\nline2\r\nline3')).toBe('\r\n');
  });

  test('returns \\n when there are no line endings', () => {
    expect(detectLineEnding('no newlines here')).toBe('\n');
  });

  test('returns \\n for single LF with no CRLF', () => {
    expect(detectLineEnding('a\nb')).toBe('\n');
  });

  test('returns \\n when LF appears before CRLF', () => {
    expect(detectLineEnding('a\nb\r\nc')).toBe('\n');
  });
});

describe('normalizeToLF', () => {
  test('replaces CRLF with LF', () => {
    expect(normalizeToLF('line1\r\nline2')).toBe('line1\nline2');
  });

  test('replaces standalone CR with LF', () => {
    expect(normalizeToLF('line1\rline2')).toBe('line1\nline2');
  });

  test('leaves LF-only content unchanged', () => {
    expect(normalizeToLF('line1\nline2')).toBe('line1\nline2');
  });

  test('handles empty string', () => {
    expect(normalizeToLF('')).toBe('');
  });
});

describe('restoreLineEndings', () => {
  test('converts LF to CRLF when ending is \\r\\n', () => {
    expect(restoreLineEndings('a\nb\nc', '\r\n')).toBe('a\r\nb\r\nc');
  });

  test('leaves LF unchanged when ending is \\n', () => {
    expect(restoreLineEndings('a\nb', '\n')).toBe('a\nb');
  });
});

describe('normalizeForFuzzyMatch', () => {
  test('trims trailing whitespace from each line', () => {
    expect(normalizeForFuzzyMatch('line1   \nline2  ')).toBe('line1\nline2');
  });

  test('replaces curly quotes with straight quotes', () => {
    expect(normalizeForFuzzyMatch('\u2018hello\u2019')).toBe("'hello'");
    expect(normalizeForFuzzyMatch('\u201Chello\u201D')).toBe('"hello"');
  });

  test('replaces em-dash and en-dash with hyphen', () => {
    expect(normalizeForFuzzyMatch('a\u2013b')).toBe('a-b');
    expect(normalizeForFuzzyMatch('a\u2014b')).toBe('a-b');
  });

  test('replaces non-breaking spaces with regular spaces', () => {
    expect(normalizeForFuzzyMatch('a\u00A0b')).toBe('a b');
  });

  test('handles empty string', () => {
    expect(normalizeForFuzzyMatch('')).toBe('');
  });
});

describe('fuzzyFindText', () => {
  test('returns exact match when text found verbatim', () => {
    const result = fuzzyFindText('hello world foo bar', 'world');
    expect(result.found).toBe(true);
    expect(result.usedFuzzyMatch).toBe(false);
    expect(result.index).toBe(6);
    expect(result.matchLength).toBe(5);
  });

  test('returns fuzzy match when only normalized form matches', () => {
    // Original has trailing spaces, oldText does not
    const content = 'hello world   \nfoo bar';
    const oldText = 'hello world\nfoo bar';
    const result = fuzzyFindText(content, oldText);
    expect(result.found).toBe(true);
    expect(result.usedFuzzyMatch).toBe(true);
  });

  test('returns not found when text absent in both forms', () => {
    const result = fuzzyFindText('apple banana', 'cherry');
    expect(result.found).toBe(false);
    expect(result.index).toBe(-1);
    expect(result.matchLength).toBe(0);
  });

  test('contentForReplacement is original content on exact match', () => {
    const content = 'hello world';
    const result = fuzzyFindText(content, 'hello');
    expect(result.contentForReplacement).toBe(content);
  });

  test('contentForReplacement is normalized content on fuzzy match', () => {
    const content = 'hello   \nworld';
    const result = fuzzyFindText(content, 'hello\nworld');
    if (result.found && result.usedFuzzyMatch) {
      expect(result.contentForReplacement).not.toBe(content);
    }
  });
});

describe('stripBom', () => {
  test('removes BOM from start of string', () => {
    const result = stripBom('\uFEFFhello');
    expect(result.bom).toBe('\uFEFF');
    expect(result.text).toBe('hello');
  });

  test('returns empty bom and original text when no BOM', () => {
    const result = stripBom('hello');
    expect(result.bom).toBe('');
    expect(result.text).toBe('hello');
  });

  test('handles empty string', () => {
    const result = stripBom('');
    expect(result.bom).toBe('');
    expect(result.text).toBe('');
  });
});

describe('generateDiffString', () => {
  test('returns empty diff and no firstChangedLine for identical content', () => {
    const { diff, firstChangedLine } = generateDiffString('same\ncontent', 'same\ncontent');
    expect(diff).toBe('');
    expect(firstChangedLine).toBeUndefined();
  });

  test('marks added lines with + prefix', () => {
    const { diff } = generateDiffString('line1\nline2', 'line1\nline2\nline3');
    expect(diff).toContain('+');
    expect(diff).toContain('line3');
  });

  test('marks removed lines with - prefix', () => {
    const { diff } = generateDiffString('line1\nline2\nline3', 'line1\nline2');
    expect(diff).toContain('-');
    expect(diff).toContain('line3');
  });

  test('reports firstChangedLine for additions', () => {
    const { firstChangedLine } = generateDiffString('a\nb', 'a\nb\nc');
    expect(firstChangedLine).toBeDefined();
    expect(firstChangedLine).toBeGreaterThan(0);
  });

  test('context lines appear around changes', () => {
    const oldContent = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
    const newContent = oldContent.replace('line10', 'CHANGED');
    const { diff } = generateDiffString(oldContent, newContent, 2);
    expect(diff).toContain('CHANGED');
    // Should have context lines before and after change
    expect(diff).toContain('line8');
    expect(diff).toContain('line12');
  });

  test('handles empty old content (pure addition)', () => {
    const { diff } = generateDiffString('', 'new content');
    expect(diff).toContain('+');
    expect(diff).toContain('new content');
  });

  test('handles empty new content (pure deletion)', () => {
    const { diff } = generateDiffString('old content', '');
    expect(diff).toContain('-');
    expect(diff).toContain('old content');
  });
});
