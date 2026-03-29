/**
 * TDD tests for ApprovalPromptComponent content preview (Feature 9).
 *
 * Tests the preview extraction logic — content up to 100 chars shown,
 * longer content truncated with "…", fallback to empty when no content.
 */
import { describe, it, expect } from 'bun:test';
import type { TUI } from '@mariozechner/pi-tui';
import { Container, Text } from '@mariozechner/pi-tui';
import { ApprovalPromptComponent } from './approval-prompt.js';

// Minimal TUI stub
const fakeTui = { requestRender: () => {} } as unknown as TUI;

// ---------------------------------------------------------------------------
// Helper: extract all Text node strings from the component tree
// ---------------------------------------------------------------------------
function extractTexts(component: Container): string[] {
  const texts: string[] = [];
  const children = (component as unknown as { children: unknown[] }).children;
  for (const child of children) {
    if ((child as { text?: string }).text !== undefined) {
      texts.push((child as { text: string }).text);
    }
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Preview extraction — pure logic mirrored from the component
// ---------------------------------------------------------------------------
function extractPreview(args: Record<string, unknown>): string | null {
  const rawContent =
    (args.content as string) ||
    (args.text as string) ||
    (args.new_string as string) ||
    '';
  const previewText = rawContent.trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!previewText) return null;
  const normalised = rawContent.trim().replace(/\s+/g, ' ');
  return previewText.length < normalised.length
    ? `"${previewText}…"`
    : `"${previewText}"`;
}

// ---------------------------------------------------------------------------
// Preview logic tests (pure function, no DOM needed)
// ---------------------------------------------------------------------------
describe('approval prompt — preview extraction', () => {
  it('shows content from args.content', () => {
    const preview = extractPreview({ content: 'Hello, world!', path: 'test.txt' });
    expect(preview).toBe('"Hello, world!"');
  });

  it('falls back to args.text when args.content is absent', () => {
    const preview = extractPreview({ text: 'fallback text', path: 'x.txt' });
    expect(preview).toBe('"fallback text"');
  });

  it('falls back to args.new_string when neither content nor text present', () => {
    const preview = extractPreview({ new_string: 'replacement value', path: 'f.ts' });
    expect(preview).toBe('"replacement value"');
  });

  it('truncates content longer than 100 chars and appends ellipsis', () => {
    const longContent = 'a'.repeat(120);
    const preview = extractPreview({ content: longContent });
    expect(preview).toBe('"' + 'a'.repeat(100) + '…"');
  });

  it('does not append ellipsis when content is exactly 100 chars', () => {
    const exactContent = 'b'.repeat(100);
    const preview = extractPreview({ content: exactContent });
    expect(preview).toBe('"' + 'b'.repeat(100) + '"');
    expect(preview?.endsWith('…"')).toBe(false);
  });

  it('returns null when no content fields are present', () => {
    const preview = extractPreview({ path: 'empty.txt' });
    expect(preview).toBeNull();
  });

  it('returns null for empty string content', () => {
    const preview = extractPreview({ content: '', path: 'e.txt' });
    expect(preview).toBeNull();
  });

  it('normalises internal whitespace before slicing', () => {
    const preview = extractPreview({ content: 'hello   world' });
    // Collapsed to "hello world"
    expect(preview).toBe('"hello world"');
  });
});

// ---------------------------------------------------------------------------
// Component integration — preview appears in rendered children
// ---------------------------------------------------------------------------
describe('ApprovalPromptComponent — rendered preview', () => {
  it('includes a muted preview line when content is provided', () => {
    const comp = new ApprovalPromptComponent('write_file', {
      path: 'src/index.ts',
      content: 'export const x = 1;',
    });
    const texts = extractTexts(comp);
    const hasPreview = texts.some((t) => t.includes('export const x = 1;'));
    expect(hasPreview).toBe(true);
  });

  it('does not include a preview line when no content is provided', () => {
    const comp = new ApprovalPromptComponent('write_file', { path: 'src/empty.ts' });
    const texts = extractTexts(comp);
    // No text should contain quotes (the preview format)
    const hasPreview = texts.some((t) => t.startsWith('"'));
    expect(hasPreview).toBe(false);
  });

  it('truncates long content in the rendered preview', () => {
    const longContent = 'x'.repeat(200);
    const comp = new ApprovalPromptComponent('write_file', { path: 'big.ts', content: longContent });
    const texts = extractTexts(comp);
    const previewLine = texts.find((t) => t.includes('x'.repeat(10)));
    expect(previewLine).toBeDefined();
    // Preview should contain ellipsis marker
    expect(previewLine).toContain('…');
  });
});
