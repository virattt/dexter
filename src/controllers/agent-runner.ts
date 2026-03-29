import { Agent } from '../agent/agent.js';
import type { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type {
  AgentConfig,
  AgentEvent,
  AnswerChunkEvent,
  ApprovalDecision,
  DoneEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from '../agent/index.js';
import type { DisplayEvent } from '../agent/types.js';
import type { HistoryItem, HistoryItemStatus, WorkingState } from '../types.js';
import { autoStoreFromRun } from '../memory/auto-store.js';

type ChangeListener = () => void;

export interface RunQueryResult {
  answer: string;
}

export class AgentRunnerController {
  private historyValue: HistoryItem[] = [];
  private workingStateValue: WorkingState = { status: 'idle' };
  private errorValue: string | null = null;
  private pendingApprovalValue: { tool: string; args: Record<string, unknown> } | null = null;
  private agentConfig: AgentConfig;
  private readonly inMemoryChatHistory: InMemoryChatHistory;
  private readonly onChange?: ChangeListener;
  private abortController: AbortController | null = null;
  private approvalResolve: ((decision: ApprovalDecision) => void) | null = null;
  private sessionApprovedTools = new Set<string>();
  /**
   * Set by cancelExecution(); survives abortController being nulled.
   * Checked at every yield point in runQuery() so cancellation is respected
   * even when it fires before Agent.create() completes.
   */
  private queryWasCancelled = false;
  /**
   * When set, calling this rejects the currently-awaited cancellable promise,
   * immediately unblocking runQuery() from whatever async operation it is in —
   * including Agent.create(), stream.next(), and handleEvent().
   */
  private triggerCancellation: (() => void) | null = null;

  /**
   * Wraps a promise so it can be instantly rejected by triggerCancellation.
   * Registers `triggerCancellation` and immediately fires it if already cancelled.
   */
  private makeCancellable<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        this.triggerCancellation = () => {
          const err = new Error('Query cancelled');
          err.name = 'AbortError';
          reject(err);
        };
        if (this.queryWasCancelled) {
          this.triggerCancellation();
        }
      }),
    ]);
  }

  constructor(
    agentConfig: AgentConfig,
    inMemoryChatHistory: InMemoryChatHistory,
    onChange?: ChangeListener,
  ) {
    this.agentConfig = agentConfig;
    this.inMemoryChatHistory = inMemoryChatHistory;
    this.onChange = onChange;
  }

  /**
   * Override the Ollama thinking flag.
   * `true` → force on, `false` → force off, `undefined` → auto-detect from model name.
   * Takes effect on the next query (Agent is created fresh per query).
   */
  setThinkEnabled(value: boolean | undefined): void {
    this.agentConfig = { ...this.agentConfig, thinkEnabled: value };
  }

  get history(): HistoryItem[] {
    return this.historyValue;
  }

  /**
   * Replaces the current display history with loaded session items.
   * Used when resuming a saved session — does not touch InMemoryChatHistory
   * (seed that separately via chatHistory.seedFromLlmMessages()).
   */
  loadHistory(items: HistoryItem[]): void {
    this.historyValue = [...items];
    this.emitChange();
  }

  get workingState(): WorkingState {
    return this.workingStateValue;
  }

  get error(): string | null {
    return this.errorValue;
  }

  get pendingApproval(): { tool: string; args: Record<string, unknown> } | null {
    return this.pendingApprovalValue;
  }

  get isProcessing(): boolean {
    return (
      this.historyValue.length > 0 && this.historyValue[this.historyValue.length - 1]?.status === 'processing'
    );
  }

  setError(error: string | null) {
    this.errorValue = error;
    this.emitChange();
  }

  respondToApproval(decision: ApprovalDecision) {
    if (!this.approvalResolve) {
      return;
    }
    this.approvalResolve(decision);
    this.approvalResolve = null;
    this.pendingApprovalValue = null;
    if (decision !== 'deny') {
      this.workingStateValue = { status: 'thinking' };
    }
    this.emitChange();
  }

  cancelExecution() {
    this.queryWasCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Unblock whatever async operation runQuery() is currently awaiting —
    // Agent.create(), stream.next(), or handleEvent().  Works even when the
    // underlying HTTP stream (e.g. Ollama cloud) ignores the AbortSignal.
    this.triggerCancellation?.();
    if (this.approvalResolve) {
      this.approvalResolve('deny');
      this.approvalResolve = null;
      this.pendingApprovalValue = null;
    }
    this.markLastProcessing('interrupted');
    this.workingStateValue = { status: 'idle' };
    this.emitChange();
  }

  async runQuery(query: string): Promise<RunQueryResult | undefined> {
    this.queryWasCancelled = false;
    this.triggerCancellation = null;
    this.abortController = new AbortController();
    let finalAnswer: string | undefined;

    const startTime = Date.now();
    const item: HistoryItem = {
      id: String(startTime),
      query,
      events: [],
      answer: '',
      status: 'processing',
      startTime,
    };
    this.historyValue = [...this.historyValue, item];
    this.inMemoryChatHistory.saveUserQuery(query);
    this.errorValue = null;
    this.workingStateValue = { status: 'thinking' };
    this.emitChange();

    try {
      // makeCancellable() races Agent.create() against triggerCancellation so
      // that pressing Escape during the (potentially slow) memory-indexer sync
      // inside Agent.create() still returns immediately.
      const agent = await this.makeCancellable(
        Agent.create({
          ...this.agentConfig,
          signal: this.abortController?.signal,
          requestToolApproval: this.requestToolApproval,
          sessionApprovedTools: this.sessionApprovedTools,
        }),
      );

      // Drive the stream manually so each next() can be raced against
      // triggerCancellation — Ollama cloud endpoints don't honour AbortSignal.
      const stream = agent.run(query, this.inMemoryChatHistory);
      let doneEvent: DoneEvent | null = null;
      while (true) {
        const nextResult = await this.makeCancellable(stream.next());
        if (nextResult.done) break;
        const event = nextResult.value;
        if (event.type === 'done') {
          finalAnswer = (event as DoneEvent).answer;
          doneEvent = event as DoneEvent;
        }
        await this.makeCancellable(this.handleEvent(event));
      }

      // Auto-persist financial context when the LLM didn't call
      // store_financial_insight itself. Fire-and-forget — never block the UI.
      if (doneEvent) {
        void autoStoreFromRun(query, doneEvent.answer, doneEvent.toolCalls);
      }

      if (finalAnswer) {
        return { answer: finalAnswer };
      }
      return undefined;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // cancelExecution() already called markLastProcessing('interrupted')
        return undefined;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.errorValue = message;
      this.markLastProcessing('error');
      this.workingStateValue = { status: 'idle' };
      this.emitChange();
      return undefined;
    } finally {
      this.abortController = null;
      this.triggerCancellation = null;
    }
  }

  private requestToolApproval = (request: { tool: string; args: Record<string, unknown> }) => {
    return new Promise<ApprovalDecision>((resolve) => {
      this.approvalResolve = resolve;
      this.pendingApprovalValue = request;
      this.workingStateValue = { status: 'approval', toolName: request.tool };
      this.emitChange();
    });
  };

  private async handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'progress': {
        // Propagate iteration counter into the current working state so the
        // spinner can display [iter/max · elapsed].
        const ws = this.workingStateValue;
        if (ws.status === 'thinking' || ws.status === 'tool') {
          this.workingStateValue = {
            ...ws,
            iteration: event.iteration,
            maxIterations: event.maxIterations,
          } as WorkingState;
        } else {
          // Store so it'll be attached when the state next transitions to thinking/tool
          this.workingStateValue = {
            status: 'thinking',
            iteration: event.iteration,
            maxIterations: event.maxIterations,
          };
        }
        break;
      }
      case 'thinking':
        this.workingStateValue = {
          status: 'thinking',
          iteration: (this.workingStateValue as { iteration?: number }).iteration,
          maxIterations: (this.workingStateValue as { maxIterations?: number }).maxIterations,
        };
        this.pushEvent({
          id: `thinking-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_start': {
        const toolId = `tool-${event.tool}-${Date.now()}`;
        this.workingStateValue = {
          status: 'tool',
          toolName: event.tool,
          iteration: (this.workingStateValue as { iteration?: number }).iteration,
          maxIterations: (this.workingStateValue as { maxIterations?: number }).maxIterations,
        };
        this.updateLastItem((last) => ({
          ...last,
          activeToolId: toolId,
          events: [
            ...last.events,
            {
              id: toolId,
              event,
              completed: false,
            } as DisplayEvent,
          ],
        }));
        break;
      }
      case 'tool_progress':
        this.updateLastItem((last) => ({
          ...last,
          events: last.events.map((entry) =>
            // Match the first incomplete tool_start for this tool name — safe for parallel calls
            (!entry.completed &&
              entry.event.type === 'tool_start' &&
              (entry.event as ToolStartEvent).tool === event.tool)
              ? { ...entry, progressMessage: event.message }
              : entry,
          ),
        }));
        break;
      case 'tool_end':
        this.finishToolEvent(event);
        this.workingStateValue = {
          status: 'thinking',
          iteration: (this.workingStateValue as { iteration?: number }).iteration,
          maxIterations: (this.workingStateValue as { maxIterations?: number }).maxIterations,
        };
        break;
      case 'tool_error':
        this.finishToolEvent(event);
        this.workingStateValue = {
          status: 'thinking',
          iteration: (this.workingStateValue as { iteration?: number }).iteration,
          maxIterations: (this.workingStateValue as { maxIterations?: number }).maxIterations,
        };
        break;
      case 'tool_approval':
        this.pushEvent({
          id: `approval-${event.tool}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_denied':
        this.pushEvent({
          id: `denied-${event.tool}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_limit':
      case 'context_cleared':
        this.pushEvent({
          id: `${event.type}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'answer_start':
        // Switch working state to idle — the streaming answer will fill the item
        this.workingStateValue = { status: 'idle' };
        break;
      case 'answer_chunk': {
        const { chunk } = event as AnswerChunkEvent;
        this.updateLastItem((last) => ({
          ...last,
          answer: (last.answer ?? '') + chunk,
        }));
        break;
      }
      case 'done': {
        const done = event as DoneEvent;
        if (done.answer) {
          await this.inMemoryChatHistory.saveAnswer(done.answer).catch(() => {});
        }
        this.updateLastItem((last) => ({
          ...last,
          answer: done.answer,
          status: 'complete',
          duration: done.totalTime,
          tokenUsage: done.tokenUsage,
          tokensPerSecond: done.tokensPerSecond,
        }));
        this.workingStateValue = { status: 'idle' };
        break;
      }
    }
    this.emitChange();
  }

  private finishToolEvent(event: AgentEvent) {
    const toolName = (event as ToolEndEvent | ToolErrorEvent).tool;
    this.updateLastItem((last) => {
      // Find the first incomplete tool_start entry for this specific tool name.
      // Using tool name (not activeToolId) is correct for parallel tool calls where
      // multiple tool_start events fire before any tool_end, making activeToolId
      // always point to whichever tool started last.
      const targetEntry = last.events.find(
        (entry) =>
          !entry.completed &&
          entry.event.type === 'tool_start' &&
          (entry.event as ToolStartEvent).tool === toolName,
      );
      if (!targetEntry) return { ...last, activeToolId: undefined };
      return {
        ...last,
        activeToolId: undefined,
        events: last.events.map((entry) =>
          entry.id === targetEntry.id ? { ...entry, completed: true, endEvent: event } : entry,
        ),
      };
    });
  }

  private pushEvent(displayEvent: DisplayEvent) {
    this.updateLastItem((last) => ({ ...last, events: [...last.events, displayEvent] }));
  }

  private updateLastItem(updater: (item: HistoryItem) => HistoryItem) {
    const last = this.historyValue[this.historyValue.length - 1];
    if (!last || last.status !== 'processing') {
      return;
    }
    const next = updater(last);
    this.historyValue = [...this.historyValue.slice(0, -1), next];
  }

  private markLastProcessing(status: HistoryItemStatus) {
    const last = this.historyValue[this.historyValue.length - 1];
    if (!last || last.status !== 'processing') {
      return;
    }
    this.historyValue = [...this.historyValue.slice(0, -1), { ...last, status }];
  }

  private emitChange() {
    this.onChange?.();
  }
}
