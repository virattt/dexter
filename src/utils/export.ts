import { writeFileSync } from 'fs';
import type { HistoryItem } from '../types.js';
import type { ToolEndEvent, ToolStartEvent } from '../agent/types.js';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(): string {
  return new Date().toISOString();
}

function exportTimestamp(): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
  return `${date}-${time}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...`;
}

/** Extract tool calls from a HistoryItem's events. */
function getToolCalls(item: HistoryItem): Array<{ tool: string; args: Record<string, unknown>; result: string; duration: number; success: boolean }> {
  const calls: Array<{ tool: string; args: Record<string, unknown>; result: string; duration: number; success: boolean }> = [];
  for (const display of item.events) {
    if (display.event.type === 'tool_start') {
      const ts = display.event as ToolStartEvent;
      if (display.completed && display.endEvent?.type === 'tool_end') {
        const te = display.endEvent as ToolEndEvent;
        calls.push({ tool: ts.tool, args: ts.args, result: te.result, duration: te.duration, success: true });
      } else if (display.completed && display.endEvent?.type === 'tool_error') {
        calls.push({ tool: ts.tool, args: ts.args, result: '', duration: 0, success: false });
      }
    }
  }
  return calls;
}

function argsToString(args: Record<string, unknown>): string {
  const s = Object.values(args).map((v) => String(v).replace(/\n/g, ' ')).join(', ');
  return truncate(s, 60);
}

function summarizeResult(tool: string, args: Record<string, unknown>, result: string): string {
  if (!result) return 'No result';
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    if (parsed.data) {
      if (Array.isArray(parsed.data)) return `Received ${(parsed.data as unknown[]).length} items`;
      if (typeof parsed.data === 'object') {
        const keys = Object.keys(parsed.data as object).filter((k) => !k.startsWith('_'));
        if (tool === 'get_financials' || tool === 'get_market_data' || tool === 'stock_screener') {
          return keys.length === 1 ? 'Called 1 data source' : `Called ${keys.length} data sources`;
        }
        return `Received ${keys.length} fields`;
      }
    }
  } catch {
    // not JSON — return first meaningful line
    const firstLine = result.split('\n').find((l) => l.trim().length > 0) ?? result;
    return truncate(firstLine.trim(), 60);
  }
  return 'Received data';
}

// ============================================================================
// Markdown export
// ============================================================================

export function exportToMarkdown(history: HistoryItem[], sessionName?: string): string {
  const completed = history.filter((h) => h.status === 'complete');
  const lines: string[] = [];

  lines.push('# Dexter Research Report');
  lines.push(`**Session:** ${sessionName ?? 'Untitled'}`);
  lines.push(`**Date:** ${isoDate()}`);
  lines.push(`**Queries:** ${completed.length}`);
  lines.push('');
  lines.push('---');

  if (completed.length === 0) {
    lines.push('');
    lines.push('_No completed queries._');
    return lines.join('\n');
  }

  for (let i = 0; i < completed.length; i++) {
    const item = completed[i];
    lines.push('');
    lines.push(`## Query ${i + 1}: ${item.query}`);

    const calls = getToolCalls(item);
    if (calls.length > 0) {
      lines.push('');
      lines.push('### Research Steps');
      lines.push('| Tool | Args | Result Summary | Duration |');
      lines.push('|------|------|----------------|----------|');
      for (const c of calls) {
        const tool = c.tool;
        const args = argsToString(c.args);
        const summary = c.success ? summarizeResult(c.tool, c.args, c.result) : 'Error';
        const dur = c.success ? `${(c.duration / 1000).toFixed(1)}s` : '—';
        lines.push(`| ${tool} | ${args} | ${summary} | ${dur} |`);
      }
    }

    if (item.answer?.trim()) {
      lines.push('');
      lines.push('### Answer');
      lines.push(item.answer.trim());
    }

    lines.push('');
    lines.push('---');
  }

  return lines.join('\n');
}

// ============================================================================
// JSON export
// ============================================================================

export function exportToJson(history: HistoryItem[], sessionName?: string): string {
  const completed = history.filter((h) => h.status === 'complete');

  const queries = completed.map((item) => {
    const calls = getToolCalls(item);
    const toolsUsed = [...new Set(calls.map((c) => c.tool))];
    const durationMs = item.duration ?? 0;
    return {
      query: item.query,
      toolsUsed,
      answer: item.answer ?? '',
      durationMs,
    };
  });

  return JSON.stringify(
    {
      session: sessionName ?? 'Untitled',
      exportedAt: isoDate(),
      queries,
    },
    null,
    2,
  );
}

// ============================================================================
// CSV export
// ============================================================================

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function exportToCsv(history: HistoryItem[]): string {
  const completed = history.filter((h) => h.status === 'complete');
  const rows: string[] = ['query,tool,args,duration_ms,status'];

  for (const item of completed) {
    const calls = getToolCalls(item);
    if (calls.length === 0) {
      rows.push(`${csvEscape(item.query)},,,,`);
    } else {
      for (const c of calls) {
        const args = argsToString(c.args);
        rows.push(
          [
            csvEscape(item.query),
            csvEscape(c.tool),
            csvEscape(args),
            String(c.success ? Math.round(c.duration) : 0),
            csvEscape(c.success ? 'success' : 'error'),
          ].join(','),
        );
      }
    }
  }

  return rows.join('\n');
}

// ============================================================================
// Unified export entry point
// ============================================================================

export function exportSession(
  history: HistoryItem[],
  format: 'markdown' | 'json' | 'csv',
  sessionName?: string,
  /** Override the auto-generated file path. If omitted, a timestamped filename is used. */
  outputPath?: string,
): { path: string; content: string } {
  const ext = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'csv';
  const filename = `dexter-export-${exportTimestamp()}.${ext}`;
  const filePath = outputPath ?? `${process.cwd()}/${filename}`;

  let content: string;
  if (format === 'markdown') {
    content = exportToMarkdown(history, sessionName);
  } else if (format === 'json') {
    content = exportToJson(history, sessionName);
  } else {
    content = exportToCsv(history);
  }

  writeFileSync(filePath, content, 'utf8');
  return { path: filePath, content };
}
