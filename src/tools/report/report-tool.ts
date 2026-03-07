import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const DEXTER_DIR = join(homedir(), '.dexter');

export const REPORT_TOOL_DESCRIPTION = `
Save reports to ~/.dexter/ for persistence and essay workflow.

## When to Use

- After writing a quarterly performance report → save it so you can reference it later and feed it to essay drafts
- User asks to save a report to disk
- Heartbeat produces a quarterly report → MANDATORY: call this tool to persist it

## Actions

- save: Write content to ~/.dexter/ (filename provided as argument). Creates ~/.dexter if needed.

## Filename Convention

- Quarterly reports: QUARTERLY-REPORT-YYYY-QN.md (e.g. QUARTERLY-REPORT-2026-Q1.md)
- Weekly reports: optional, same pattern if desired
`.trim();

const reportSchema = z.object({
  filename: z
    .string()
    .describe('Filename only (e.g. QUARTERLY-REPORT-2026-Q1.md). Saved to ~/.dexter/'),
  content: z.string().describe('Full report content (markdown).'),
});

export const reportTool = new DynamicStructuredTool({
  name: 'save_report',
  description:
    'Save a report (e.g. quarterly performance report) to ~/.dexter/ for persistence and essay workflow.',
  schema: reportSchema,
  func: async (input) => {
    if (!input.filename.endsWith('.md')) {
      return 'Error: filename should end with .md';
    }
    const filePath = join(DEXTER_DIR, input.filename);
    if (!existsSync(DEXTER_DIR)) {
      mkdirSync(DEXTER_DIR, { recursive: true });
    }
    writeFileSync(filePath, input.content, 'utf-8');
    return `Saved report to ~/.dexter/${input.filename} (${input.content.length} characters).`;
  },
});
