import { describe, it, expect } from 'bun:test';
import chalk from 'chalk';
import {
  parseMarkdownTable,
  renderBoxTable,
  transformMarkdownTables,
  formatResponse,
  transformHeaders,
  transformItalic,
  transformInlineCode,
  transformLists,
  transformURLs,
} from './markdown-table.js';

// Strip markdown formatting markers and ANSI escape codes to get visible text width.
function visualWidth(s: string): number {
  return s
    .replace(/\x1b\[[0-9;]*m/g, '')     // strip ANSI codes
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → content
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* → content
    .replace(/_([^_\s][^_]*)_/g, '$1')  // _italic_ → content
    .length;
}

describe('parseMarkdownTable', () => {
  it('parses a simple markdown table', () => {
    const md = `| A | B |\n|---|---|\n| x | y |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['A', 'B']);
    expect(result!.rows).toEqual([['x', 'y']]);
  });

  it('returns null for non-table input', () => {
    expect(parseMarkdownTable('no pipes here')).toBeNull();
  });

  it('trims whitespace from cells', () => {
    const md = `|  Ticker  |  Price  |\n|----------|--------|\n|  HON  |  $225  |`;
    const result = parseMarkdownTable(md);
    expect(result!.headers).toEqual(['Ticker', 'Price']);
    expect(result!.rows[0]).toEqual(['HON', '$225']);
  });
});

describe('renderBoxTable — plain text', () => {
  it('produces uniform column widths', () => {
    const headers = ['Ticker', 'Price'];
    const rows = [['HON', '$225'], ['INTU', '$450']];
    const output = renderBoxTable(headers, rows);
    const lines = output.split('\n');
    // For plain text (no markdown), raw lengths must all be equal
    const widths = lines.map(l => l.length);
    expect(widths.every(w => w === widths[0])).toBe(true);
  });

  it('pads short data cells to column width', () => {
    const headers = ['Ticker', 'Price'];
    const rows = [['A', '$1']];
    const output = renderBoxTable(headers, rows);
    const dataRow = output.split('\n')[3]; // order: top, header, sep, data, bottom
    // Column width = len("Ticker") = 6, "A" should be padded to 6 chars
    expect(dataRow).toContain('│ A      │');
  });
});

describe('renderBoxTable — bold markdown in cells', () => {
  it('uses visible width for columns with **bold** cell values', () => {
    // LLM often bolds tickers: **HON**, **MU**, **AMAT**
    const headers = ['Ticker', 'Price'];
    const rows = [
      ['**HON**', '~$225'],
      ['**MU**', '~$380'],
      ['**INTU**', '~$430'],
      ['**AMAT**', '~$180'],
    ];
    const output = renderBoxTable(headers, rows);
    const lines = output.split('\n');
    // Visual widths must be equal across all lines
    const visWidths = lines.map(visualWidth);
    expect(visWidths.every(w => w === visWidths[0])).toBe(true);
  });

  it('sizes the border to visible column width, not raw markdown length', () => {
    // **AMAT** raw = 8 chars but visible = 4 — column width should be max(6,"HON"=3,"MU"=2,"INTU"=4,"GS"=2,"AMAT"=4) = 6
    const headers = ['Ticker', 'Price'];
    const rows = [['**HON**', '$225'], ['**MU**', '$380'], ['**INTU**', '$430'], ['**AMAT**', '$180']];
    const output = renderBoxTable(headers, rows);
    const topBorder = output.split('\n')[0];
    // colWidth(6) + 2 = 8 dashes in first segment
    expect(topBorder.startsWith('┌────────┬')).toBe(true);
  });

  it('produces equal visual widths for header and data rows', () => {
    const headers = ['Ticker', 'Price'];
    const rows = [['**HON**', '~$225']];
    const output = renderBoxTable(headers, rows);
    const lines = output.split('\n');
    const headerRow = lines[1];
    const dataRow = lines[3];
    // Visual widths (stripping **) must match
    expect(visualWidth(headerRow)).toBe(visualWidth(dataRow));
  });

  it('handles bold text in headers', () => {
    const headers = ['**Ticker**', 'Price'];
    const rows = [['HON', '$225']];
    const output = renderBoxTable(headers, rows);
    const lines = output.split('\n');
    // Visual widths must all be equal
    const visWidths = lines.map(visualWidth);
    expect(visWidths.every(w => w === visWidths[0])).toBe(true);
    // colWidth = max(visible("**Ticker**")=6, visible("HON")=3) = 6 → 8 dashes in first segment
    expect(lines[0].startsWith('┌────────┬')).toBe(true);
  });
});

describe('transformMarkdownTables', () => {
  it('converts a markdown table to box-drawing characters', () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const result = transformMarkdownTables(md);
    expect(result).toContain('┌');
    expect(result).toContain('┘');
    expect(result).toContain('│');
  });

  it('produces consistent visual line widths for bold-cell tables', () => {
    const md = `| Ticker | Price |\n|--------|-------|\n| **HON** | ~$225 |\n| **AMAT** | ~$180 |`;
    const result = transformMarkdownTables(md);
    const lines = result.split('\n').filter(l =>
      l.startsWith('│') || l.startsWith('┌') || l.startsWith('├') || l.startsWith('└'),
    );
    const visWidths = lines.map(visualWidth);
    expect(visWidths.every(w => w === visWidths[0])).toBe(true);
  });
});

describe('formatResponse (full pipeline)', () => {
  it('converts tables and bold markers, borders and data rows same visual width', () => {
    const md = `| Ticker | Price |\n|--------|-------|\n| **HON** | **$225** |\n| **AMAT** | **$180** |`;
    const result = formatResponse(md);
    expect(result).toContain('┌');
    expect(result).toContain('│');
    const lines = result.split('\n');
    const borderLine = lines[0];  // top border — no ANSI codes
    const sepLine = lines[2];      // header separator — no ANSI codes
    // Border lines (no ANSI, no markdown) have equal raw length
    expect(borderLine.length).toBe(sepLine.length);
    // All lines have equal visual width
    const visWidths = lines.filter(Boolean).map(visualWidth);
    expect(visWidths.every(w => w === visWidths[0])).toBe(true);
  });

  it('bold-cell table: header and data rows have same visual width after full pipeline', () => {
    const md = `| **Ticker** | **Price** |\n|--------|-------|\n| **HON** | $225 |\n| **AMAT** | $180 |`;
    const result = formatResponse(md);
    const lines = result.split('\n');
    const headerRow = lines[1];
    const dataRow = lines[3];
    expect(visualWidth(headerRow)).toBe(visualWidth(dataRow));
  });
});

describe('transformHeaders', () => {
  it('H1: # Title → contains bold yellow text', () => {
    const result = transformHeaders('# Title');
    expect(result).toContain(chalk.bold(chalk.yellow('Title')));
  });

  it('H2: ## Section → contains bold text', () => {
    const result = transformHeaders('## Section');
    expect(result).toBe(chalk.bold('Section'));
  });

  it('H3: ### Sub → contains bold dim text', () => {
    const result = transformHeaders('### Sub');
    expect(result).toBe(chalk.bold(chalk.dim('Sub')));
  });

  it('does not transform non-header lines', () => {
    const result = transformHeaders('plain text');
    expect(result).toBe('plain text');
  });

  it('H1 has surrounding newlines', () => {
    const result = transformHeaders('# Title');
    expect(result.startsWith('\n')).toBe(true);
    expect(result.endsWith('\n')).toBe(true);
  });
});

describe('transformItalic', () => {
  it('*hello* → chalk italic', () => {
    const result = transformItalic('*hello*');
    expect(result).toBe(chalk.italic('hello'));
  });

  it('_hello_ → chalk italic', () => {
    const result = transformItalic('_hello_');
    expect(result).toBe(chalk.italic('hello'));
  });

  it('**bold** is NOT converted to italic', () => {
    // Bold markers should not be treated as italic — transformItalic leaves ** untouched
    const result = transformItalic('**bold**');
    expect(result).toBe('**bold**');
    // Confirm the result is unchanged (no italic ANSI codes were injected)
    expect(result).toBe(transformItalic('**bold**'));
  });

  it('mixed bold and italic text', () => {
    const result = formatResponse('**bold** and *italic*');
    expect(result).toContain(chalk.bold('bold'));
    expect(result).toContain(chalk.italic('italic'));
  });

  it('does not italicize snake_case', () => {
    const result = transformItalic('some_variable_name');
    expect(result).toBe('some_variable_name');
  });
});

describe('transformInlineCode', () => {
  it('`const x = 1` → cyan styled output', () => {
    const result = transformInlineCode('`const x = 1`');
    expect(result).toBe(chalk.cyan('const x = 1'));
  });

  it('removes backticks and styles content', () => {
    const result = transformInlineCode('use `npm install`');
    expect(result).toContain(chalk.cyan('npm install'));
    expect(result).not.toContain('`');
  });
});

describe('transformLists', () => {
  it('- item → • item', () => {
    const result = transformLists('- item');
    expect(result).toContain('• item');
  });

  it('* item → • item', () => {
    const result = transformLists('* item');
    expect(result).toContain('• item');
  });

  it('ordered list: 1. item keeps number', () => {
    const result = transformLists('1. First item');
    expect(result).toContain('1.');
    expect(result).toContain('First item');
  });

  it('unordered list marker is replaced with bullet', () => {
    const result = transformLists('- Buy stocks\n- Sell bonds');
    expect(result).toContain('• Buy stocks');
    expect(result).toContain('• Sell bonds');
    expect(result).not.toContain('- Buy');
  });
});

describe('transformURLs', () => {
  it('bare URL → cyan underlined', () => {
    const result = transformURLs('https://fred.stlouisfed.org');
    expect(result).toContain(chalk.cyan.underline('https://fred.stlouisfed.org'));
  });

  it('URL in markdown link syntax is not double-styled', () => {
    const result = transformURLs('[FRED](https://fred.stlouisfed.org)');
    // The URL after ( should not be transformed
    expect(result).toBe('[FRED](https://fred.stlouisfed.org)');
  });

  it('http:// URLs are also styled', () => {
    const result = transformURLs('http://example.com');
    expect(result).toContain(chalk.cyan.underline('http://example.com'));
  });
});

