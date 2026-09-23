/** Tokens left at which the model is warned that a reset is coming. */
export const REMINDER_THRESHOLD_TOKENS = 6_144;

/** Extra tokens granted after the threshold so the model can write notes before reset. */
export const FALLBACK_BUFFER_TOKENS = 16_384;

/** Upper bound on the notes hint injected at the start of each window. */
export const MAX_THREAD_HINT_BYTES = 4_000;

/** Upper bound on a single note file. */
export const MAX_NOTE_BYTES = 1_000_000;

/** Default number of history items returned by list/search calls. */
export const DEFAULT_HISTORY_LIMIT = 20;

/** Characters of content shown per history item in list/search results. */
export const HISTORY_PREVIEW_CHARS = 300;
