import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'fs';
import { AIMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { AgentToolExecutor } from './tool-executor.js';
import type { RunContext } from './run-context.js';
import type { ApprovalDecision } from './types.js';
import { loadApprovedTools } from '../utils/tool-permissions.js';

const PERMISSIONS_FILE = '.dexter/permissions.json';

// Only the scratchpad calls the executor makes for a non-skill tool.
const ctx = {
  scratchpad: { canCallTool: () => ({}), recordToolCall: () => {}, addToolResult: () => {} },
} as unknown as RunContext;

/** Runs one write_file call, answers its approval prompt, and returns the prompt count. */
async function runWriteFile(answer: ApprovalDecision, grants: Set<string>): Promise<number> {
  let prompts = 0;
  const writeFile = { name: 'write_file', invoke: async () => 'ok' } as unknown as StructuredToolInterface;
  const executor = new AgentToolExecutor(
    new Map([['write_file', writeFile]]),
    new Map([['write_file', false]]),
    undefined,
    async () => {
      prompts++;
      return answer;
    },
    grants,
  );
  const response = new AIMessage({
    content: '',
    tool_calls: [{ id: 'call-1', name: 'write_file', args: { path: 'notes.md', content: 'hi' } }],
  });
  for await (const event of executor.executeAll(response, ctx)) {
    expect(event.type).not.toBe('tool_error');
  }
  return prompts;
}

beforeEach(() => {
  rmSync(PERMISSIONS_FILE, { force: true });
});

afterEach(() => {
  rmSync(PERMISSIONS_FILE, { force: true });
});

describe('AgentToolExecutor edit approvals', () => {
  test('allow-session keeps the grant in memory and never saves it', async () => {
    const grants = new Set<string>();
    expect(await runWriteFile('allow-session', grants)).toBe(1);
    expect(grants.has('file:write')).toBe(true);
    expect(existsSync(PERMISSIONS_FILE)).toBe(false);
  });

  test('allow-always saves the grant so a new session does not prompt', async () => {
    expect(await runWriteFile('allow-always', new Set())).toBe(1);
    expect(loadApprovedTools()).toEqual(['file:write']);
    expect(await runWriteFile('deny', new Set(loadApprovedTools()))).toBe(0);
  });
});
