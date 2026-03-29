/**
 * Minimal entry shape used for searching — a subset of HistoryItem that
 * carries the fields needed for keyword matching and display.
 */
export interface HistoryEntry {
  query: string;
  answer: string;
  turn: number;
}

/**
 * Search session history for entries whose query or answer contains the
 * given keyword (case-insensitive).
 *
 * Returns an empty array when keyword is empty, history is empty, or no
 * entries match.
 */
export function searchHistory(history: HistoryEntry[], keyword: string): HistoryEntry[] {
  if (!keyword || history.length === 0) return [];
  const lower = keyword.toLowerCase();
  return history.filter(
    (entry) =>
      entry.query.toLowerCase().includes(lower) ||
      entry.answer.toLowerCase().includes(lower),
  );
}
