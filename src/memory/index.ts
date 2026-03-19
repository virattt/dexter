/**
 * Memory module for Dexter-Br.
 *
 * Provides file-based memory persistence across sessions.
 * Files:
 *   ~/.dexter/MEMORY.md            — long-term notes
 *   ~/.dexter/daily/YYYY-MM-DD.md  — daily session notes
 *
 * Note: This is a simplified implementation using plain markdown files.
 * A future upgrade can add SQLite + vector search for semantic recall,
 * similar to the upstream Dexter memory module.
 */

export {
  readLongTermMemory,
  readDailyMemory,
  loadSessionContext,
  appendDailyMemory,
  appendLongTermMemory,
  writeLongTermMemory,
} from './store.js';
