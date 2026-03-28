import type {
  ContextClearedEvent,
  ReasoningEvent,
  ThinkingEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from '../agent/types.js';
import type { HistoryItem } from '../types.js';
import { theme } from '../theme.js';
import { formatResponse } from './markdown-table.js';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  const lastSpace = str.lastIndexOf(' ', max);
  return lastSpace > max * 0.5 ? `${str.slice(0, lastSpace)}...` : `${str.slice(0, max)}...`;
}

function formatToolName(name: string): string {
  return name
    .replace(/^(get)_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatToolArgs(tool: string, args: Record<string, unknown>): string {
  if (tool === 'sequential_thinking') {
    const thought = String(args.thought ?? '').replace(/\n/g, ' ');
    const num = args.thoughtNumber ?? '?';
    const total = args.totalThoughts ?? '?';
    const prefix = args.isRevision ? '🔄' : args.branchFromThought ? '🌿' : '💭';
    return theme.muted(`${prefix} ${num}/${total} "${truncate(thought, 60)}"`);
  }
  if ('query' in args) return theme.muted(`"${truncate(String(args.query), 60)}"`);
  if (tool === 'memory_update') {
    const text = String(args.content ?? args.old_text ?? '').replace(/\n/g, ' ');
    if (text) return theme.muted(truncate(text, 80));
  }
  return theme.muted(
    Object.entries(args)
      .map(([k, v]) => `${k}=${truncate(String(v).replace(/\n/g, '\\n'), 60)}`)
      .join(', '),
  );
}

function summarizeToolResult(tool: string, args: Record<string, unknown>, result: string): string {
  if (tool === 'skill') return `Loaded ${args.skill as string} skill`;
  try {
    const parsed = JSON.parse(result);
    if (parsed.data) {
      if (Array.isArray(parsed.data)) return `Received ${parsed.data.length} items`;
      if (typeof parsed.data === 'object') {
        const keys = Object.keys(parsed.data).filter((k) => !k.startsWith('_'));
        if (tool === 'get_financials' || tool === 'get_market_data' || tool === 'stock_screener') {
          return keys.length === 1 ? 'Called 1 data source' : `Called ${keys.length} data sources`;
        }
        if (tool === 'web_search') return 'Did 1 search';
        return `Received ${keys.length} fields`;
      }
    }
  } catch {
    return truncate(result, 50);
  }
  return 'Received data';
}

/**
 * Format a completed exchange as plain ANSI text for the terminal scrollback buffer.
 * Renders the user query, all tool calls with results, the final answer, and timing stats.
 */
export function formatExchangeForScrollback(item: HistoryItem): string {
  const lines: string[] = [];

  // User query — matches UserQueryComponent styling
  lines.push('');
  lines.push(theme.queryBg(theme.white(`❯ ${item.query} `)));

  // Events: tool calls, thinking snippets, reasoning, context resets
  for (const display of item.events) {
    const event = display.event;

    if (event.type === 'thinking') {
      const msg = (event as ThinkingEvent).message.trim();
      if (msg) {
        lines.push(theme.muted(`  💭 ${msg.length > 120 ? `${msg.slice(0, 120)}…` : msg}`));
      }
      continue;
    }

    if (event.type === 'reasoning') {
      const content = (event as ReasoningEvent).content.trim();
      if (content) {
        const preview = content.length > 300 ? `${content.slice(0, 300)}...` : content;
        lines.push('');
        lines.push(theme.muted(`💭 Reasoning (${content.length} chars)`));
        lines.push(theme.muted(preview));
      }
      continue;
    }

    if (event.type === 'tool_start') {
      const ts = event as ToolStartEvent;
      const isSkill = ts.tool === 'skill';
      const bullet = isSkill ? theme.accent('⚡') : theme.muted('⏺');
      const toolLabel = isSkill
        ? `${theme.accent('Skill:')} ${theme.accent(String(ts.args.skill ?? formatToolName(ts.tool)))}${theme.muted('()')}`
        : `${formatToolName(ts.tool)}${theme.muted('(')}${formatToolArgs(ts.tool, ts.args)}${theme.muted(')')}`;
      const title = toolLabel;

      lines.push('');
      if (display.completed && display.endEvent?.type === 'tool_end') {
        const done = display.endEvent as ToolEndEvent;
        const summary = isSkill ? `Loaded ${String(ts.args.skill ?? ts.tool)} skill` : summarizeToolResult(done.tool, ts.args, done.result);
        lines.push(`${theme.success('✓')} ${title}`);
        lines.push(`${theme.muted('⎿  ')}${summary}${theme.muted(` in ${formatDuration(done.duration)}`)}`);
      } else if (display.completed && display.endEvent?.type === 'tool_error') {
        const err = display.endEvent as ToolErrorEvent;
        lines.push(`${theme.error('✗')} ${title}`);
        lines.push(`${theme.muted('⎿  ')}${theme.error(`Error: ${truncate(err.error, 80)}`)}`);
      } else {
        lines.push(`${bullet} ${title}`);
        lines.push(theme.muted('⎿  Interrupted'));
      }
      continue;
    }

    if (event.type === 'context_cleared') {
      const cc = event as ContextClearedEvent;
      lines.push('');
      lines.push(theme.muted(`  ↺ Context refreshed (kept ${cc.keptCount}, cleared ${cc.clearedCount})`));
      continue;
    }
  }

  // Final answer or status line
  lines.push('');
  if (item.answer?.trim()) {
    const formatted = formatResponse(item.answer.trim());
    lines.push(`${theme.primary('⏺ ')}${formatted}`);
  } else if (item.status === 'interrupted') {
    lines.push(theme.muted('  ⎿  Interrupted'));
  } else if (item.status === 'error') {
    lines.push(theme.error('  ⎿  Error — see above for details'));
  }

  // Performance footer
  if (item.duration != null) {
    lines.push('');
    lines.push(theme.muted(`✻ ${formatDuration(item.duration)}`));
  }

  // Visual separator — makes it easy to scan back through a long session
  lines.push('');
  lines.push(theme.dim('  ' + '─'.repeat(54)));
  lines.push('');
  return lines.join('\n');
}
