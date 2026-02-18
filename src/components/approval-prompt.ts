import { Container, Text } from '@mariozechner/pi-tui';
import type { ApprovalDecision } from '../agent/types.js';
import { createApprovalSelector, createTradingApprovalSelector } from './select-list.js';
import { theme } from '../theme.js';

const ZERODHA_TRADING_TOOLS = new Set([
  'zerodha_place_order',
  'zerodha_modify_order',
  'zerodha_cancel_order',
]);

function formatToolLabel(tool: string): string {
  return tool
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatApprovalSummary(tool: string, args: Record<string, unknown>): string {
  if (tool === 'zerodha_place_order') {
    const t = args.transaction_type as string;
    const qty = args.quantity as number;
    const sym = args.tradingsymbol as string;
    const exchange = args.exchange as string;
    const orderType = args.order_type as string;
    return `${t} ${qty} ${sym} @ ${exchange} (${orderType})`;
  }
  if (tool === 'zerodha_modify_order' || tool === 'zerodha_cancel_order') {
    return `order ${args.order_id as string}`;
  }
  return (args.path as string) || '<unknown>';
}

export class ApprovalPromptComponent extends Container {
  readonly selector: any;
  onSelect?: (decision: ApprovalDecision) => void;

  constructor(tool: string, args: Record<string, unknown>) {
    super();
    const isTrading = ZERODHA_TRADING_TOOLS.has(tool);
    this.selector = isTrading
      ? createTradingApprovalSelector((decision) => this.onSelect?.(decision))
      : createApprovalSelector((decision) => this.onSelect?.(decision));
    const width = Math.max(20, process.stdout.columns ?? 80);
    const border = theme.warning('─'.repeat(width));
    const summary = formatApprovalSummary(tool, args);

    this.addChild(new Text(border, 0, 0));
    this.addChild(new Text(theme.warning(theme.bold('Permission required')), 0, 0));
    this.addChild(new Text(`${formatToolLabel(tool)} ${summary}`, 0, 0));
    this.addChild(new Text(theme.muted('Do you want to allow this?'), 0, 0));
    this.addChild(new Text('', 0, 0));
    this.addChild(this.selector);
    this.addChild(new Text('', 0, 0));
    this.addChild(new Text(theme.muted('Enter to confirm · esc to deny'), 0, 0));
    this.addChild(new Text(border, 0, 0));
  }
}
