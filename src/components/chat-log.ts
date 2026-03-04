import { Container, Spacer, Text, type TUI } from '@mariozechner/pi-tui';
import type { TokenUsage } from '../agent/types.js';
import { theme } from '../theme.js';
import { AnswerBoxComponent } from './answer-box.js';
import { ToolEventComponent } from './tool-event.js';
import { UserQueryComponent } from './user-query.js';

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function truncateUrl(url: string, maxLen = 45): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length <= maxLen ? display : `${display.slice(0, maxLen)}...`;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen)}...` : url;
  }
}

function formatBrowserStep(args: Record<string, unknown>): string | null {
  const action = args.action as string | undefined;
  const url = args.url as string | undefined;
  switch (action) {
    case 'open':
      return `Opening ${truncateUrl(url || '')}`;
    case 'navigate':
      return `Navigating to ${truncateUrl(url || '')}`;
    case 'snapshot':
      return 'Reading page structure';
    case 'read':
      return 'Extracting page text';
    case 'close':
      return 'Closing browser';
    case 'act':
      return null;
    default:
      return null;
  }
}

interface ToolDisplayComponent {
  setActive(progressMessage?: string): void;
  setComplete(summary: string, duration: number): void;
  setError(error: string): void;
  setLimitWarning(warning?: string): void;
  setApproval(decision: 'allow-once' | 'allow-session' | 'deny'): void;
  setDenied(path: string, tool: string): void;
}

class BrowserSessionComponent extends Container implements ToolDisplayComponent {
  private readonly header: Text;
  private detail: Text | null = null;
  private currentStep: string | null = null;

  constructor(_tui: TUI) {
    super();
    this.addChild(new Spacer(1));
    this.header = new Text('⏺ Browser', 0, 0);
    this.addChild(this.header);
  }

  setStep(args: Record<string, unknown>) {
    const step = formatBrowserStep(args);
    if (step) {
      this.currentStep = step;
    }
  }

  setActive(progressMessage?: string): void {
    this.clearDetail();
    const message = progressMessage || this.currentStep || 'Searching...';
    this.detail = new Text(`${theme.muted('⎿  ')}${message}`, 0, 0);
    this.addChild(this.detail);
  }

  setComplete(summary: string, duration: number): void {
    this.clearDetail();
    const text = this.currentStep || `${summary}${theme.muted(` in ${formatDuration(duration)}`)}`;
    this.detail = new Text(`${theme.muted('⎿  ')}${text}`, 0, 0);
    this.addChild(this.detail);
  }

  setError(error: string): void {
    this.clearDetail();
    this.detail = new Text(`${theme.muted('⎿  ')}${theme.error(`Error: ${error}`)}`, 0, 0);
    this.addChild(this.detail);
  }

  setLimitWarning(warning?: string): void {
    this.clearDetail();
    this.detail = new Text(`${theme.muted('⎿  ')}${theme.warning(warning || 'Approaching suggested limit')}`, 0, 0);
    this.addChild(this.detail);
  }

  setApproval(decision: 'allow-once' | 'allow-session' | 'deny'): void {
    this.clearDetail();
    const label =
      decision === 'allow-once'
        ? 'Approved'
        : decision === 'allow-session'
          ? 'Approved (session)'
          : 'Denied';
    const color = decision === 'deny' ? theme.warning : theme.primary;
    this.detail = new Text(`${theme.muted('⎿  ')}${color(label)}`, 0, 0);
    this.addChild(this.detail);
  }

  setDenied(path: string, tool: string): void {
    this.clearDetail();
    const action = tool === 'write_file' ? 'write to' : tool === 'edit_file' ? 'edit of' : tool;
    this.detail = new Text(`${theme.muted('⎿  ')}${theme.warning(`User denied ${action} ${path}`)}`, 0, 0);
    this.addChild(this.detail);
  }

  private clearDetail() {
    if (this.detail) {
      this.removeChild(this.detail);
      this.detail = null;
    }
  }
}

export class ChatLogComponent extends Container {
  private readonly tui: TUI;
  private readonly toolById = new Map<string, ToolDisplayComponent>();
  private currentBrowserSession: BrowserSessionComponent | null = null;
  private activeAnswer: AnswerBoxComponent | null = null;
  private lastToolName: string | null = null;
  private lastToolComponent: ToolDisplayComponent | null = null;

  constructor(tui: TUI) {
    super();
    this.tui = tui;
  }

  clearAll() {
    this.clear();
    this.toolById.clear();
    this.currentBrowserSession = null;
    this.activeAnswer = null;
    this.lastToolName = null;
    this.lastToolComponent = null;
  }

  addQuery(query: string) {
    this.addChild(new UserQueryComponent(query));
  }

  resetToolGrouping() {
    this.lastToolName = null;
    this.lastToolComponent = null;
  }

  addInterrupted() {
    this.addChild(new Text(`${theme.muted('⎿  Interrupted · What should Dexter do instead?')}`, 0, 0));
  }

  startTool(toolCallId: string, toolName: string, args: Record<string, unknown>) {
    if (toolName !== 'browser') {
      this.currentBrowserSession = null;
    }

    const existing = this.toolById.get(toolCallId);
    if (existing) {
      existing.setActive();
      return existing;
    }

    if (toolName === 'browser') {
      if (!this.currentBrowserSession) {
        this.currentBrowserSession = new BrowserSessionComponent(this.tui);
        this.addChild(this.currentBrowserSession);
      }
      this.currentBrowserSession.setStep(args);
      this.currentBrowserSession.setActive();
      this.toolById.set(toolCallId, this.currentBrowserSession);
      this.lastToolName = null;
      this.lastToolComponent = null;
      return this.currentBrowserSession;
    }

    if (this.lastToolName === toolName && this.lastToolComponent) {
      this.lastToolComponent.setActive();
      this.toolById.set(toolCallId, this.lastToolComponent);
      return this.lastToolComponent;
    }

    const component = new ToolEventComponent(this.tui, toolName, args);
    component.setActive();
    this.toolById.set(toolCallId, component);
    this.addChild(component);
    this.lastToolName = toolName;
    this.lastToolComponent = component;
    return component;
  }

  updateToolProgress(toolCallId: string, message: string) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setActive(message);
  }

  completeTool(toolCallId: string, summary: string, duration: number) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setComplete(summary, duration);
  }

  errorTool(toolCallId: string, error: string) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setError(error);
  }

  limitTool(toolCallId: string, warning?: string) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setLimitWarning(warning);
  }

  approveTool(toolCallId: string, decision: 'allow-once' | 'allow-session' | 'deny') {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setApproval(decision);
  }

  denyTool(toolCallId: string, path: string, tool: string) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setDenied(path, tool);
  }

  finalizeAnswer(text: string) {
    if (!this.activeAnswer) {
      this.addChild(new AnswerBoxComponent(text));
      return;
    }
    this.activeAnswer.setText(text);
    this.activeAnswer = null;
  }

  addContextCleared(clearedCount: number, keptCount: number) {
    this.addChild(
      new Text(
        `${theme.muted(
          `⏺ Context threshold reached - cleared ${clearedCount} old tool result${clearedCount !== 1 ? 's' : ''}, kept ${keptCount} most recent`,
        )}`,
        0,
        0,
      ),
    );
  }

  addPerformanceStats(duration: number, tokenUsage?: TokenUsage, tokensPerSecond?: number) {
    if (!tokenUsage) {
      return;
    }
    const parts = [formatDuration(duration), `${tokenUsage.totalTokens.toLocaleString()} tokens`];
    if (tokensPerSecond !== undefined) {
      parts.push(`(${tokensPerSecond.toFixed(1)} tok/s)`);
    }
    this.addChild(new Spacer(1));
    this.addChild(new Text(`${theme.muted('✻ ')}${theme.muted(parts.join(' · '))}`, 0, 0));
  }
}
