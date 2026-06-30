import { Container, Text, truncateToWidth } from '@mariozechner/pi-tui';
import type { ApprovalDecision } from '../agent/types.js';
import { createApprovalSelector } from './select-list.js';
import { theme } from '../theme.js';

function formatToolLabel(tool: string): string {
  return tool
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface ApprovalPromptOptions {
  /** For bash: the command being approved (shown instead of args.path). */
  command?: string;
  /** Optional one-line explanation shown under the headline. */
  reason?: string;
  /** For bash: a rule the user can persist via "always allow" (adds a 4th option). */
  proposedRule?: string;
}

export class ApprovalPromptComponent extends Container {
  readonly selector: any;
  onSelect?: (decision: ApprovalDecision) => void;

  constructor(tool: string, args: Record<string, unknown>, opts: ApprovalPromptOptions = {}) {
    super();
    this.selector = createApprovalSelector((decision) => this.onSelect?.(decision), opts.proposedRule);
    const width = Math.max(20, process.stdout.columns ?? 80);
    const border = theme.warning('─'.repeat(width));

    // bash surfaces the command; file tools surface the path.
    const target =
      opts.command !== undefined
        ? opts.command || '<empty command>'
        : (args.path as string) || '<unknown>';
    const headline = truncateToWidth(`${formatToolLabel(tool)}  ${target}`, width, '…');

    this.addChild(new Text(border, 0, 0));
    this.addChild(new Text(theme.warning(theme.bold('Permission required')), 0, 0));
    this.addChild(new Text(headline, 0, 0));
    if (opts.reason) {
      this.addChild(new Text(theme.muted(truncateToWidth(opts.reason, width, '…')), 0, 0));
    }
    this.addChild(new Text(theme.muted('Do you want to allow this?'), 0, 0));
    this.addChild(new Text('', 0, 0));
    this.addChild(this.selector);
    this.addChild(new Text('', 0, 0));
    this.addChild(new Text(theme.muted('Enter to confirm · esc to deny'), 0, 0));
    this.addChild(new Text(border, 0, 0));
  }
}
