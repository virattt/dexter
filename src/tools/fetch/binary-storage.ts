/**
 * Binary content persistence for web_fetch.
 *
 * When a fetched URL returns binary data (PDFs, images, archives, etc.) the
 * raw bytes are written to disk with a mime-derived extension so the agent can
 * inspect the file later. The decoded text is still summarized inline; the
 * saved file is a supplement, not a replacement.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dexterPath } from '../../utils/paths.js';

// Directory where binary downloads are persisted.
const WEB_FETCH_OUTPUT_DIR = dexterPath('web-fetch');

// Content types that are textual and therefore never treated as binary, even
// though their top-level type may not be `text/*`.
const TEXTUAL_CONTENT_TYPES = [
  'text/',
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'application/ecmascript',
  'application/ld+json',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
];

// Mime type -> file extension. Gives persisted binaries a real extension so
// downstream tools (and the user) can open them.
const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/markdown': 'md',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0]!.trim().toLowerCase();
}

/**
 * Whether a content type should be treated as binary (saved to disk) rather
 * than decoded as text.
 */
export function isBinaryContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return false;
  }
  if (TEXTUAL_CONTENT_TYPES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return true;
}

function extensionForContentType(contentType: string): string {
  const normalized = normalizeContentType(contentType);
  return MIME_TO_EXTENSION[normalized] ?? 'bin';
}

export type PersistResult = { filepath: string; size: number } | { error: string };

/**
 * Persist raw binary bytes to the web-fetch output directory.
 * Returns the file path and size, or an error.
 */
export function persistBinaryContent(
  buffer: Buffer,
  contentType: string,
  id: string,
): PersistResult {
  try {
    const extension = extensionForContentType(contentType);
    const filepath = join(WEB_FETCH_OUTPUT_DIR, `${id}.${extension}`);
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filepath, buffer);
    return { filepath, size: buffer.length };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
