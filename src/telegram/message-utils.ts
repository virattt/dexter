const MAX_LENGTH = 4096;
const SAFE_LENGTH = 4000; // Safety margin for Telegram's limit

/**
 * Splits a message into chunks that fit within Telegram's 4096 character limit.
 * Tries to split at paragraph boundaries, then line boundaries, then hard limit.
 */
export function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIndex = remaining.lastIndexOf('\n\n', SAFE_LENGTH);

    // Fall back to line boundary
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('\n', SAFE_LENGTH);
    }

    // Hard split at safe length
    if (splitIndex <= 0) {
      splitIndex = SAFE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
