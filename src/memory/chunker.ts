import { createHash } from 'node:crypto';
import type { MemoryChunk } from './types.js';

function lineCount(text: string): number {
  if (!text) {
    return 1;
  }
  return text.split('\n').length;
}

function tokenToCharBudget(tokens: number): number {
  // Keep the same approximation used in src/utils/tokens.ts.
  return Math.max(1, Math.floor(tokens * 3.5));
}

type Paragraph = {
  text: string;
  startLine: number;
  endLine: number;
};

function splitIntoParagraphs(text: string): Paragraph[] {
  if (!text.trim()) {
    return [];
  }

  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  let start = 0;

  const pushParagraph = (startLineIdx: number, endLineIdx: number) => {
    const paragraphText = lines.slice(startLineIdx, endLineIdx + 1).join('\n').trim();
    if (!paragraphText) {
      return;
    }
    paragraphs.push({
      text: paragraphText,
      startLine: startLineIdx + 1,
      endLine: endLineIdx + 1,
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]?.trim() === '') {
      if (i > start) {
        pushParagraph(start, i - 1);
      }
      start = i + 1;
    }
  }
  if (start < lines.length) {
    pushParagraph(start, lines.length - 1);
  }

  return paragraphs;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function chunkMemoryText(params: {
  filePath: string;
  text: string;
  chunkTokens: number;
  overlapTokens: number;
}): MemoryChunk[] {
  const paragraphs = splitIntoParagraphs(params.text);
  if (paragraphs.length === 0) {
    return [];
  }

  const chunkBudget = tokenToCharBudget(params.chunkTokens);
  const overlapBudget = tokenToCharBudget(params.overlapTokens);
  const chunks: MemoryChunk[] = [];

  let startIndex = 0;
  while (startIndex < paragraphs.length) {
    let endIndex = startIndex;
    let content = '';
    let startLine = paragraphs[startIndex]?.startLine ?? 1;
    let endLine = paragraphs[startIndex]?.endLine ?? startLine;

    while (endIndex < paragraphs.length) {
      const candidate = paragraphs[endIndex];
      if (!candidate) {
        break;
      }
      const candidateText = content ? `${content}\n\n${candidate.text}` : candidate.text;
      if (candidateText.length > chunkBudget && content) {
        break;
      }
      content = candidateText;
      endLine = candidate.endLine;
      endIndex += 1;
      if (candidateText.length >= chunkBudget) {
        break;
      }
    }

    if (!content) {
      break;
    }

    chunks.push({
      filePath: params.filePath,
      startLine,
      endLine,
      content,
      contentHash: hashContent(content),
    });

    if (endIndex >= paragraphs.length) {
      break;
    }

    let carryChars = 0;
    let nextStart = endIndex;
    while (nextStart > startIndex) {
      const prev = paragraphs[nextStart - 1];
      if (!prev) {
        break;
      }
      carryChars += prev.text.length;
      if (carryChars > overlapBudget) {
        break;
      }
      nextStart -= 1;
    }

    if (nextStart === startIndex) {
      // Ensure forward progress when a single paragraph is larger than overlap.
      nextStart = Math.max(startIndex + 1, endIndex);
    }
    startIndex = nextStart;
  }

  return chunks;
}

export function buildSnippet(content: string, maxChars = 700): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxChars) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxChars).trim()}...`;
}

export function estimateChunkTokens(chunk: MemoryChunk): number {
  return Math.ceil(chunk.content.length / 3.5);
}

export function countLinesInChunk(chunk: MemoryChunk): number {
  return lineCount(chunk.content);
}
