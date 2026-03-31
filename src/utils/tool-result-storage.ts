/**
 * Disk persistence for large tool results.
 *
 * When a tool result exceeds the size cap, the full result is saved to disk
 * and a compact preview + file path replaces it in the message array.
 * The model can read the full result back via read_file if needed.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dexterPath } from './paths.js';

/** Maximum characters for a single tool result in context. */
export const MAX_TOOL_RESULT_CHARS = 50_000;

/** Characters to include in the preview when a result is persisted. */
export const PREVIEW_CHARS = 2_000;

const RESULTS_DIR = dexterPath('tool-results');

/**
 * Persist a large tool result to disk and return a compact preview.
 */
export function persistLargeResult(
  toolName: string,
  toolCallId: string,
  result: string,
): { preview: string; filePath: string } {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const sanitizedId = toolCallId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${RESULTS_DIR}/${sanitizedId}.txt`;
  writeFileSync(filePath, result, 'utf-8');

  const preview = result.slice(0, PREVIEW_CHARS);
  return { preview, filePath };
}

/**
 * Build the replacement content for a persisted tool result.
 */
export function buildPersistedContent(
  filePath: string,
  preview: string,
  originalSizeBytes: number,
): string {
  const sizeKB = Math.round(originalSizeBytes / 1024);
  return `[Result persisted to ${filePath} (${sizeKB} KB)]\n\nPreview:\n${preview}\n\nUse read_file to access the full result if needed.`;
}

/**
 * Check if a result exceeds the size cap.
 */
export function exceedsSizeCap(content: string): boolean {
  return content.length > MAX_TOOL_RESULT_CHARS;
}
