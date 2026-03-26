/**
 * SessionController — session lifecycle management.
 *
 * Owns the current session ID, coordinates auto-save with debouncing,
 * and fires background priorSummary compaction when a session exceeds
 * DEFAULT_HISTORY_LIMIT exchanges.
 */

import {
  createSession,
  saveSession,
  listSessions,
  loadSession,
  type SessionFile,
  type SessionIndexEntry,
  type SessionLlmMessage,
} from '../utils/session-store.js';
import { DEFAULT_HISTORY_LIMIT } from '../utils/history-context.js';
import type { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { HistoryItem } from '../types.js';

export type SummarizerFn = (messages: SessionLlmMessage[]) => Promise<string>;

export class SessionController {
  private currentSessionId: string | null = null;
  private currentSession: SessionFile | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private priorSummary: string | undefined;
  private lastSavedMessageCount = 0;

  constructor(
    private readonly baseDir: string = process.cwd(),
    private readonly summarizer?: SummarizerFn,
  ) {}

  get sessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Starts a new session named from the first query.
   * Replaces any previous current session.
   */
  async startSession(firstQuery: string): Promise<void> {
    const session = await createSession(firstQuery, this.baseDir);
    this.currentSessionId = session.id;
    this.currentSession = session;
    this.priorSummary = undefined;
    this.lastSavedMessageCount = 0;
  }

  /**
   * Debounced save (250 ms) — merges latest history + chatHistory state into the
   * session file. Triggers background priorSummary compaction when the session
   * crosses a DEFAULT_HISTORY_LIMIT (10) exchange boundary.
   */
  autosave(history: HistoryItem[], chatHistory: InMemoryChatHistory): void {
    if (!this.currentSession) return;

    if (this.saveTimer) clearTimeout(this.saveTimer);

    const llmMessages: SessionLlmMessage[] = chatHistory
      .getMessages()
      .filter((m) => m.answer !== null)
      .map((m) => ({ query: m.query, answer: m.answer!, summary: m.summary }));

    const completedCount = history.filter((h) => h.status === 'complete').length;

    const snapshot: SessionFile = {
      ...this.currentSession,
      queryCount: completedCount,
      lastModified: Date.now(),
      llmMessages,
      history,
      priorSummary: this.priorSummary,
    };

    this.saveTimer = setTimeout(() => void this.doSave(snapshot, llmMessages), 250);
  }

  private async doSave(snapshot: SessionFile, llmMessages: SessionLlmMessage[]): Promise<void> {
    // Trigger compaction when the session first exceeds DEFAULT_HISTORY_LIMIT and
    // each time it crosses another multiple (20, 30, …).
    // blockOf: which "compaction block" a count belongs to (-1 = never triggered).
    const blockOf = (n: number) => (n <= 0 ? -1 : Math.floor((n - 1) / DEFAULT_HISTORY_LIMIT));
    if (
      this.summarizer &&
      llmMessages.length > DEFAULT_HISTORY_LIMIT &&
      blockOf(llmMessages.length) > blockOf(this.lastSavedMessageCount)
    ) {
      // Fire-and-forget — the next autosave will include the result.
      void this.generatePriorSummary(llmMessages);
    }

    this.lastSavedMessageCount = llmMessages.length;
    await saveSession({ ...snapshot, priorSummary: this.priorSummary }, this.baseDir);
    // Keep currentSession in sync so future snapshots inherit the latest metadata.
    this.currentSession = { ...snapshot, priorSummary: this.priorSummary };
  }

  private async generatePriorSummary(messages: SessionLlmMessage[]): Promise<void> {
    if (!this.summarizer) return;
    // Summarise everything beyond the most recent DEFAULT_HISTORY_LIMIT exchanges.
    const olderMessages = messages.slice(0, -DEFAULT_HISTORY_LIMIT);
    try {
      this.priorSummary = await this.summarizer(olderMessages);
    } catch {
      // Non-fatal — session saves proceed without a priorSummary.
    }
  }

  /**
   * Adopts a loaded session as the current session (for resuming).
   * Future auto-saves will append to this session.
   */
  startSessionFromLoaded(session: SessionFile): void {
    this.currentSessionId = session.id;
    this.currentSession = session;
    this.priorSummary = session.priorSummary;
    this.lastSavedMessageCount = session.llmMessages.length;
  }

  /**
   * Loads the full session file by ID.
   */
  async loadSession(id: string): Promise<SessionFile | null> {
    return loadSession(id, this.baseDir);
  }

  /**
   * Returns session index entries newest-first.
   */
  async listSessions(): Promise<SessionIndexEntry[]> {
    return listSessions(this.baseDir);
  }
}
