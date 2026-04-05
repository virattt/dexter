/**
 * NotebookLM tool for Dexter — web research via Google NotebookLM.
 * Creates notebooks, adds sources, runs deep research, chats with content.
 * Uses the notebooklm-py CLI via subprocess.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { formatToolResult } from '../types.js';

const execAsync = promisify(exec);

export const NB_CREATE_DESCRIPTION = `
Create a NotebookLM research notebook, run web research on a topic, and chat with the results. Uses Google NotebookLM for deep, source-based analysis.
`.trim();

export const NB_ASK_DESCRIPTION = `
Chat with a NotebookLM notebook. Asks questions based on the sources already added to the notebook.
`.trim();

/**
 * Check if notebooklm CLI is available and authenticated.
 */
async function checkNotebookLMStatus(): Promise<string | null> {
  try {
    const { stdout, stderr } = await execAsync(`notebooklm status 2>&1`, {
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
      timeout: 30000,
    });
    return stdout.trim() || stderr.trim();
  } catch {
    return null;
  }
}

const NB_CREATE_DESCRIPTION = `
Create a NotebookLM research notebook, run web research on a topic, and chat with the results. Uses Google NotebookLM for deep, source-based analysis.
`.trim();

const nbCreateSchema = z.object({
  topic: z.string().describe('Research topic or query'),
  mode: z.enum(['fast', 'deep']).default('deep').describe('Research depth. "fast" for quick overview (30s-2min), "deep" for comprehensive (2-5 min).'),
});

export const notebooklmResearchTool = new DynamicStructuredTool({
  name: 'notebooklm_create',
  description: 'Create a NotebookLM research notebook, run web research, and optionally chat with sources.',
  schema: nbCreateSchema,
  func: async (input) => {
    try {
      // Check auth
      const status = await checkNotebookLMStatus();
      if (!status || !status.toLowerCase().includes('authenticated')) {
        return formatToolResult({
          error: 'NotebookLM authentication required. Run: notebooklm login (opens browser for Google OAuth).',
        });
      }

      // Create notebook
      const { stdout } = await execAsync(`notebooklm create "Research: ${input.topic}" --json 2>&1`, {
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: 60000,
      });
      const jsonMatch = stdout.match(/\{.*\}/s);
      if (!jsonMatch) {
        return formatToolResult({ error: `NotebookLM create failed: ${stdout}` });
      }
      const notebook = JSON.parse(jsonMatch[0]);
      const notebookId = notebook.id;

      // Start research
      const researchCmd = `notebooklm source add-research "${input.topic}" --mode ${input.mode} --import-all --notebook ${notebookId} 2>&1`;
      const { stdout: researchOut, stderr: researchErr } = await execAsync(researchCmd, {
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: input.mode === 'deep' ? 300000 : 90000,
      });

      return formatToolResult({
        notebook_id: notebookId,
        topic: input.topic,
        mode: input.mode,
        research_result: researchOut.trim() || researchErr.trim(),
      });
    } catch (error: unknown) {
      return formatToolResult({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

const NB_ASK_DESCRIPTION = `
Chat with a NotebookLM notebook. Asks questions based on the sources already added to the notebook.
`.trim();

const nbAskSchema = z.object({
  notebook_id: z.string().describe('Notebook ID to chat with.'),
  question: z.string().describe('Question to ask the notebook.'),
});

export const notebooklmAskTool = new DynamicStructuredTool({
  name: 'notebooklm_ask',
  description: 'Ask questions of a NotebookLM notebook. Gets answers with source citations.',
  schema: nbAskSchema,
  func: async (input) => {
    try {
      const { stdout } = await execAsync(`notebooklm ask "${input.question}" --json --notebook ${input.notebook_id} 2>&1`, {
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: 60000,
      });
      const jsonMatch = stdout.match(/\{.*\}/s);
      if (!jsonMatch) {
        return formatToolResult({ error: stdout.trim() || 'No response from NotebookLM.' });
      }
      return formatToolResult(JSON.parse(jsonMatch[0]));
    } catch (error: unknown) {
      return formatToolResult({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
