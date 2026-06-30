import { Agent } from '../agent/agent.js';
import type { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { defaultQueue } from '../utils/message-queue.js';
import type {
  AgentConfig,
  AgentEvent,
  ApprovalDecision,
  DoneEvent,
} from '../agent/index.js';
import type { Question, UserAnswers } from '../tools/ask-user-question/types.js';
import type { PermissionDecision } from '../permissions/types.js';

/** A pending approval request surfaced to the CLI overlay. */
export interface PendingApproval {
  tool: string;
  args: Record<string, unknown>;
  /** For bash: the command being approved (shown instead of args.path). */
  command?: string;
  /** The engine's decision (reason, classification, etc.). */
  decision?: PermissionDecision;
}
import type { DisplayEvent, StreamMode } from '../agent/types.js';
import type { HistoryItem, HistoryItemStatus, WorkingState } from '../types.js';

export interface TurnStats {
  turnStartMs: number;
  streamedChars: number;
  streamMode: StreamMode;
}

type ChangeListener = () => void;

export interface RunQueryResult {
  answer: string;
}

export class AgentRunnerController {
  private historyValue: HistoryItem[] = [];
  private workingStateValue: WorkingState = { status: 'idle' };
  private errorValue: string | null = null;
  private pendingApprovalValue: PendingApproval | null = null;
  private pendingQuestionValue: { questions: Question[] } | null = null;
  private turnStartMsValue: number | null = null;
  private streamedCharsValue = 0;
  private streamModeValue: StreamMode | null = null;
  private agentConfig: AgentConfig;
  private readonly inMemoryChatHistory: InMemoryChatHistory;
  private readonly onChange?: ChangeListener;
  private abortController: AbortController | null = null;
  private approvalResolve: ((decision: ApprovalDecision) => void) | null = null;
  private questionResolve: ((answers: UserAnswers) => void) | null = null;
  private sessionApprovedTools = new Set<string>();

  constructor(
    agentConfig: AgentConfig,
    inMemoryChatHistory: InMemoryChatHistory,
    onChange?: ChangeListener,
  ) {
    this.agentConfig = agentConfig;
    this.inMemoryChatHistory = inMemoryChatHistory;
    this.onChange = onChange;
  }

  get history(): HistoryItem[] {
    return this.historyValue;
  }

  get workingState(): WorkingState {
    return this.workingStateValue;
  }

  get error(): string | null {
    return this.errorValue;
  }

  get pendingApproval(): PendingApproval | null {
    return this.pendingApprovalValue;
  }

  get pendingQuestion(): { questions: Question[] } | null {
    return this.pendingQuestionValue;
  }

  get turnStats(): TurnStats | null {
    if (this.turnStartMsValue === null) return null;
    return {
      turnStartMs: this.turnStartMsValue,
      streamedChars: this.streamedCharsValue,
      streamMode: this.streamModeValue ?? 'requesting',
    };
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

  get currentConfig(): Readonly<AgentConfig> {
    return this.agentConfig;
  }

  updateAgentConfig(config: Partial<Pick<AgentConfig, 'model' | 'modelProvider' | 'maxIterations'>>) {
    this.agentConfig = {
      ...this.agentConfig,
      ...config,
    };
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

  respondToQuestion(answers: UserAnswers) {
    if (!this.questionResolve) {
      return;
    }
    this.questionResolve(answers);
    this.questionResolve = null;
    this.pendingQuestionValue = null;
    this.workingStateValue = { status: 'thinking' };
    this.emitChange();
  }

  cancelExecution() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.approvalResolve) {
      this.approvalResolve('deny');
      this.approvalResolve = null;
      this.pendingApprovalValue = null;
    }
    if (this.questionResolve) {
      this.questionResolve({ answers: [], declined: true });
      this.questionResolve = null;
      this.pendingQuestionValue = null;
    }
    this.markLastProcessing('interrupted');
    this.workingStateValue = { status: 'idle' };
    this.resetTurnStats();
    this.emitChange();
  }

  async runQuery(query: string): Promise<RunQueryResult | undefined> {
    this.abortController = new AbortController();
    let finalAnswer: string | undefined;

    // bash `allow-session` grants are scoped to a single query: prune them at the
    // start of each new query while leaving write/edit (file:write) grants intact.
    for (const key of this.sessionApprovedTools) {
      if (key.startsWith('bash:')) this.sessionApprovedTools.delete(key);
    }

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
    this.turnStartMsValue = startTime;
    this.streamedCharsValue = 0;
    this.streamModeValue = 'requesting';
    this.emitChange();

    try {
      const agent = await Agent.create({
        ...this.agentConfig,
        signal: this.abortController.signal,
        requestToolApproval: this.requestToolApproval,
        requestUserInput: this.requestUserInput,
        sessionApprovedTools: this.sessionApprovedTools,
        messageQueue: defaultQueue,
      });
      const stream = agent.run(query, this.inMemoryChatHistory);
      for await (const event of stream) {
        if (event.type === 'done') {
          finalAnswer = (event as DoneEvent).answer;
        }
        await this.handleEvent(event);
      }

      // Post-run: if messages arrived after the agent's last drain, start a new turn
      if (!defaultQueue.isEmpty()) {
        const remaining = defaultQueue.dequeueAll();
        const mergedText = remaining.map(m => m.text).join('\n\n');
        return this.runQuery(mergedText);
      }

      if (finalAnswer) {
        return { answer: finalAnswer };
      }
      return undefined;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.markLastProcessing('interrupted');
        this.workingStateValue = { status: 'idle' };
        this.resetTurnStats();
        this.emitChange();
        return undefined;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.errorValue = message;
      this.markLastProcessing('error');
      this.workingStateValue = { status: 'idle' };
      this.resetTurnStats();
      this.emitChange();
      return undefined;
    } finally {
      this.abortController = null;
    }
  }

  private resetTurnStats() {
    this.turnStartMsValue = null;
    this.streamedCharsValue = 0;
    this.streamModeValue = null;
  }

  private requestToolApproval = (request: PendingApproval) => {
    return new Promise<ApprovalDecision>((resolve) => {
      this.approvalResolve = resolve;
      this.pendingApprovalValue = request;
      this.workingStateValue = { status: 'approval', toolName: request.tool };
      this.emitChange();
    });
  };

  private requestUserInput = (request: { questions: Question[] }) => {
    return new Promise<UserAnswers>((resolve) => {
      this.questionResolve = resolve;
      this.pendingQuestionValue = request;
      this.workingStateValue = { status: 'question' };
      this.emitChange();
    });
  };

  private async handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'thinking':
        this.workingStateValue = { status: 'thinking' };
        this.pushEvent({
          id: `thinking-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_start': {
        const toolId = event.toolCallId ?? `tool-${event.tool}-${Date.now()}`;
        this.workingStateValue = { status: 'tool', toolName: event.tool };
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
      case 'tool_progress': {
        const progressToolId = event.toolCallId ?? this.getLastItem()?.activeToolId;
        this.updateLastItem((last) => ({
          ...last,
          events: last.events.map((entry) =>
            entry.id === progressToolId ? { ...entry, progressMessage: event.message } : entry,
          ),
        }));
        break;
      }
      case 'tool_end': {
        const endToolId = event.toolCallId ?? this.getLastItem()?.activeToolId;
        this.updateLastItem((last) => ({
          ...last,
          events: last.events.map((entry) =>
            entry.id === endToolId ? { ...entry, completed: true, endEvent: event } : entry,
          ),
        }));
        this.workingStateValue = { status: 'thinking' };
        break;
      }
      case 'tool_error': {
        const errToolId = event.toolCallId ?? this.getLastItem()?.activeToolId;
        this.updateLastItem((last) => ({
          ...last,
          events: last.events.map((entry) =>
            entry.id === errToolId ? { ...entry, completed: true, endEvent: event } : entry,
          ),
        }));
        this.workingStateValue = { status: 'thinking' };
        break;
      }
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
      case 'compaction':
      case 'microcompact':
      case 'queue_drain':
        this.pushEvent({
          id: `${event.type}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'stream_progress':
        // Update accumulators without firing onChange — the working indicator
        // pulls turnStats on its own spinner tick. Avoids a per-chunk emitChange
        // storm that stutters input.
        this.streamedCharsValue += event.charDelta;
        this.streamModeValue = event.mode;
        return;
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
        this.resetTurnStats();
        break;
      }
    }
    this.emitChange();
  }

  private pushEvent(displayEvent: DisplayEvent) {
    this.updateLastItem((last) => ({ ...last, events: [...last.events, displayEvent] }));
  }

  private getLastItem(): HistoryItem | undefined {
    return this.historyValue[this.historyValue.length - 1];
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
