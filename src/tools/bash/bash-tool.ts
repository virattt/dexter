import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runShell, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from './shell-runner.js';
import { BASH_TOOL_DESCRIPTION } from './prompt.js';

export { BASH_TOOL_DESCRIPTION };

const BashInputSchema = z.object({
  command: z.string().min(1).describe('The shell command to run via `/bin/sh -c`.'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Hard timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS}).`),
  description: z
    .string()
    .optional()
    .describe('A short (3-7 word) description of what the command does, shown in the approval prompt.'),
});

/**
 * Build the bash tool. Takes `model` only to match the registry's `createX(model)`
 * factory convention; the shell runner does not use it.
 */
export function createBash(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'bash',
    description:
      'Run a shell command and return its stdout, stderr, and exit code. CLI only; every command requires approval.',
    schema: BashInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      const signal = config?.signal as AbortSignal | undefined;

      onProgress?.(`$ ${input.command}`);

      const result = await runShell(input.command, {
        timeoutMs: input.timeout,
        signal,
        onData: (chunk) => {
          // Stream the last non-empty line as a progress update.
          const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
          const last = lines[lines.length - 1];
          if (last) {
            onProgress?.(last.slice(0, 120));
          }
        },
      });

      return formatToolResult({
        command: input.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        interrupted: result.interrupted,
        timedOut: result.timedOut,
        truncated: result.truncated,
        durationMs: result.durationMs,
      });
    },
  });
}
