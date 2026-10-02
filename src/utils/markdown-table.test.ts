import { describe, expect, test } from 'bun:test';
import { formatResponse, parseMarkdownTable, renderBoxTable } from './markdown-table.js';

describe('markdown table outer pipes', () => {
  const headers = ['Name', 'Revenue', 'Profit'];
  const rows = [['Acme', '100', '20']];
  const borders = [
    { name: 'no outer pipes', left: '', right: '' },
    { name: 'a leading pipe only', left: '| ', right: '' },
    { name: 'a trailing pipe only', left: '', right: ' |' },
    { name: 'both outer pipes', left: '| ', right: ' |' },
  ];

  for (const { name, left, right } of borders) {
    test(`keeps all columns with ${name}`, () => {
      const table = [headers, ['---', '---', '---'], ...rows]
        .map(cells => `${left}${cells.join(' | ')}${right}`)
        .join('\n');

      expect(parseMarkdownTable(table)).toEqual({ headers, rows });
      expect(formatResponse(table)).toBe(renderBoxTable(headers, rows));
    });
  }

  for (const emptyIndex of [0, 1, 2]) {
    test(`preserves an empty header in column ${emptyIndex + 1}`, () => {
      const emptyHeaders = headers.map((header, index) => index === emptyIndex ? '' : header);
      const table = [emptyHeaders, ['---', '---', '---'], ...rows]
        .map(cells => `| ${cells.join(' | ')} |`)
        .join('\n');

      expect(parseMarkdownTable(table)).toEqual({ headers: emptyHeaders, rows });
    });
  }
});
