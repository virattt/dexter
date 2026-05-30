import { Container, Spacer, Text, type TUI } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import { subscribeSpinner, SPINNER_INTERVAL_MS } from '../utils/spinner.js';
import { formatTokensCompact } from '../utils/format.js';
import { decodeSubagentProgress } from '../tools/subagent/progress.js';

const CIRCLE = '⏺';

/**
 * Display handle for a single delegated subagent. Returned by
 * SubagentGroupComponent.addCall and stored as the tool component for that
 * tool_call id, so progress/completion route to the correct node. Structurally
 * matches the chat log's ToolDisplayComponent interface.
 */
export interface SubagentLineHandle {
  setActive(progressMessage?: string): void;
  setComplete(summary: string, duration: number): void;
  setError(error: string): void;
  setLimitWarning(warning?: string): void;
  setApproval(decision: 'allow-once' | 'allow-session' | 'deny'): void;
  setDenied(path: string, tool: string): void;
  dispose?(): void;
}

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) return `${str.slice(0, lastSpace)}...`;
  return `${str.slice(0, maxLength)}...`;
}

type LineState = 'active' | 'done' | 'error';

interface SubagentLine {
  type: string;
  description: string;
  headerLine: Text;
  statusLine: Text;
  state: LineState;
  toolUseCount: number;
  tokens: number | null;
  activity: string;
}

/**
 * Groups one or more delegated subagents under a single header, rendered as a
 * tree: the header names how many agents are running, and each agent is a node
 * showing its tool-use count, token estimate, and a one-line rolled-up activity.
 * Mirrors a leader → subagents fan-out — independent workers shown side by side,
 * each with its own live status, rather than collapsed into one ambiguous row.
 */
export class SubagentGroupComponent extends Container {
  private readonly header: Text;
  private readonly lines: SubagentLine[] = [];
  private unsubscribeSpinner: (() => void) | null = null;
  private blinkVisible = true;
  private blinkCounter = 0;

  constructor(_tui: TUI) {
    super();
    this.addChild(new Spacer(1));
    this.header = new Text('', 0, 0);
    this.addChild(this.header);
    this.renderAll();
    this.startBlink();
  }

  private get activeCount(): number {
    return this.lines.filter((l) => l.state === 'active').length;
  }

  private startBlink() {
    const ticksPerHalfPeriod = Math.max(1, Math.round(600 / SPINNER_INTERVAL_MS));
    this.unsubscribeSpinner = subscribeSpinner(() => {
      this.blinkCounter++;
      if (this.blinkCounter % ticksPerHalfPeriod === 0) {
        this.blinkVisible = !this.blinkVisible;
        this.header.setText(this.headerText());
      }
    });
  }

  private stopBlinkIfDone() {
    if (this.activeCount === 0 && this.unsubscribeSpinner) {
      this.unsubscribeSpinner();
      this.unsubscribeSpinner = null;
    }
  }

  private commonType(): string | null {
    if (this.lines.length === 0) return null;
    const first = this.lines[0]!.type;
    return this.lines.every((l) => l.type === first) ? first : null;
  }

  private headerText(): string {
    const active = this.activeCount > 0;
    const circle = active ? (this.blinkVisible ? theme.success(CIRCLE) : ' ') : theme.primary(CIRCLE);
    const common = this.commonType();
    const typeLabel = common && common !== 'general-purpose' ? `${common} ` : '';
    const n = this.lines.length;
    const noun = `${typeLabel}${n === 1 ? 'agent' : 'agents'}`;
    const text = active ? `Running ${n} ${noun}…` : `${n} ${noun} finished`;
    return `${circle} ${text}`;
  }

  private renderAll() {
    this.header.setText(this.headerText());
    const n = this.lines.length;
    const hideType = this.commonType() !== null;
    this.lines.forEach((line, i) => {
      const isLast = i === n - 1;
      const treeChar = isLast ? '└─' : '├─';
      const label = hideType
        ? theme.bold(line.description)
        : `${theme.bold(line.type)} ${theme.muted(`(${line.description})`)}`;
      const uses = `${line.toolUseCount} tool ${line.toolUseCount === 1 ? 'use' : 'uses'}`;
      const tokens = line.tokens != null ? ` · ${formatTokensCompact(line.tokens)} tokens` : '';
      const stats = theme.muted(` · ${uses}${tokens}`);
      line.headerLine.setText(`   ${theme.muted(treeChar)} ${label}${stats}`);

      const branch = isLast ? '   ⎿  ' : '│  ⎿  ';
      const status = line.state === 'error' ? theme.error(line.activity) : theme.muted(line.activity);
      line.statusLine.setText(`   ${theme.muted(branch)}${status}`);
    });
  }

  /** Add a subagent node and return its display handle. */
  addCall(args: Record<string, unknown>): SubagentLineHandle {
    const description =
      typeof args.description === 'string' && args.description.trim()
        ? truncateAtWord(args.description.trim().replace(/\n/g, ' '), 60)
        : truncateAtWord(String(args.task ?? 'sub-task').split('\n')[0] ?? 'sub-task', 60);
    const line: SubagentLine = {
      type: String(args.subagent_type ?? 'general-purpose'),
      description,
      headerLine: new Text('', 0, 0),
      statusLine: new Text('', 0, 0),
      state: 'active',
      toolUseCount: 0,
      tokens: null,
      activity: 'Initializing…',
    };
    this.lines.push(line);
    this.addChild(line.headerLine);
    this.addChild(line.statusLine);
    this.renderAll();
    return this.makeHandle(line);
  }

  private makeHandle(line: SubagentLine): SubagentLineHandle {
    return {
      setActive: (progressMessage?: string) => {
        if (!progressMessage) return;
        const progress = decodeSubagentProgress(progressMessage);
        if (progress) {
          line.toolUseCount = progress.toolUseCount;
          line.tokens = progress.tokens;
          line.activity = progress.activity;
          if (progress.done) line.state = 'done';
        } else {
          line.activity = progressMessage;
        }
        this.renderAll();
        this.stopBlinkIfDone();
      },
      setComplete: (_summary: string, _duration: number) => {
        if (line.state === 'active') {
          line.state = 'done';
          line.activity = 'Done';
        }
        this.renderAll();
        this.stopBlinkIfDone();
      },
      setError: (error: string) => {
        line.state = 'error';
        line.activity = `Failed: ${truncateAtWord(error, 60)}`;
        this.renderAll();
        this.stopBlinkIfDone();
      },
      setLimitWarning: () => {},
      setApproval: () => {},
      setDenied: () => {},
      dispose: () => {
        if (line.state === 'active') line.state = 'done';
        this.stopBlinkIfDone();
      },
    };
  }

  dispose() {
    if (this.unsubscribeSpinner) {
      this.unsubscribeSpinner();
      this.unsubscribeSpinner = null;
    }
  }
}
