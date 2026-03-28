import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { ApprovalDecision } from '../agent/types.js';
import { theme } from '../theme.js';

function formatToolName(name: string): string {
  // Strip common verb prefixes for cleaner display (get_financials → Financials)
  const stripped = name.replace(/^(get)_/, '');
  return stripped
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) {
    return `${str.slice(0, lastSpace)}...`;
  }
  return `${str.slice(0, maxLength)}...`;
}

function formatArgs(tool: string, args: Record<string, unknown>): string {
  if (tool === 'sequential_thinking') {
    const thought = String(args.thought ?? '').replace(/\n/g, ' ');
    const num = args.thoughtNumber ?? '?';
    const total = args.totalThoughts ?? '?';
    const prefix = args.isRevision ? '🔄' : args.branchFromThought ? '🌿' : '💭';
    return theme.muted(`${prefix} ${num}/${total} "${truncateAtWord(thought, 60)}"`);
  }
  if ('query' in args) {
    const query = String(args.query);
    return theme.muted(`"${truncateAtWord(query, 60)}"`);
  }
  if (tool === 'memory_update') {
    const text = String(args.content ?? args.old_text ?? '').replace(/\n/g, ' ');
    if (text) return theme.muted(truncateAtWord(text, 80));
  }
  return theme.muted(
    Object.entries(args)
      .map(([key, value]) => `${key}=${truncateAtWord(String(value).replace(/\n/g, '\\n'), 60)}`)
      .join(', '),
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function approvalLabel(decision: ApprovalDecision): string {
  switch (decision) {
    case 'allow-once':
      return 'Approved';
    case 'allow-session':
      return 'Approved (session)';
    case 'deny':
      return 'Denied';
  }
}

export class ToolEventComponent extends Container {
  private readonly header: Text;
  private readonly titleText: string;
  private completedDetails: Text[] = [];
  private activeDetail: Text | null = null;

  constructor(_tui: unknown, tool: string, args: Record<string, unknown>) {
    super();
    this.addChild(new Spacer(1));
    const isSkill = tool === 'skill';
    if (isSkill) {
      const skillName = String(args.skill ?? 'skill');
      this.titleText = `${theme.accent('Skill:')} ${theme.accent(skillName)}${theme.muted('()')}`;
      this.header = new Text(`${theme.accent('⚡')} ${this.titleText}`, 0, 0);
    } else {
      this.titleText = `${formatToolName(tool)}${args ? `${theme.muted('(')}${formatArgs(tool, args)}${theme.muted(')')}` : ''}`;
      this.header = new Text(`${theme.muted('⏺')} ${this.titleText}`, 0, 0);
    }
    this.addChild(this.header);
  }

  private setHeaderBullet(bullet: string, color: (s: string) => string) {
    this.header.setText(`${color(bullet)} ${this.titleText}`);
  }

  setActive(progressMessage?: string) {
    this.setHeaderBullet('⚡', theme.warning);
    this.clearDetail();
    const message = progressMessage || 'Searching...';
    this.activeDetail = new Text(`${theme.muted('⎿  ')}${message}`, 0, 0);
    this.addChild(this.activeDetail);
  }

  setComplete(summary: string, duration: number) {
    this.setHeaderBullet('✓', theme.success);
    this.clearDetail();
    const detail = new Text(
      `${theme.muted('⎿  ')}${summary}${theme.muted(` in ${formatDuration(duration)}`)}`,
      0,
      0
    );
    this.completedDetails.push(detail);
    this.addChild(detail);
  }

  setError(error: string) {
    this.setHeaderBullet('✗', theme.error);
    this.clearDetail();
    const detail = new Text(`${theme.muted('⎿  ')}${theme.error(`Error: ${truncateAtWord(error, 80)}`)}`, 0, 0);
    this.completedDetails.push(detail);
    this.addChild(detail);
  }

  setLimitWarning(warning?: string) {
    this.setHeaderBullet('⚠', theme.warning);
    this.clearDetail();
    this.activeDetail = new Text(
      `${theme.muted('⎿  ')}${theme.warning(truncateAtWord(warning || 'Approaching suggested limit', 100))}`,
      0,
      0,
    );
    this.addChild(this.activeDetail);
  }

  setDenied(path: string, tool: string) {
    this.setHeaderBullet('⊘', theme.muted);
    this.clearDetail();
    const action = tool === 'write_file' ? 'write to' : tool === 'edit_file' ? 'edit of' : tool;
    const detail = new Text(`${theme.muted('⎿  ')}${theme.warning(`User denied ${action} ${path}`)}`, 0, 0);
    this.completedDetails.push(detail);
    this.addChild(detail);
  }

  setApproval(decision: ApprovalDecision) {
    if (decision === 'deny') {
      this.setHeaderBullet('⊘', theme.muted);
    } else {
      this.setHeaderBullet('✓', theme.success);
    }
    this.clearDetail();
    const color = decision !== 'deny' ? theme.primary : theme.warning;
    const detail = new Text(`${theme.muted('⎿  ')}${color(approvalLabel(decision))}`, 0, 0);
    this.completedDetails.push(detail);
    this.addChild(detail);
  }

  private clearDetail() {
    if (this.activeDetail) {
      this.removeChild(this.activeDetail);
      this.activeDetail = null;
    }
  }
}
