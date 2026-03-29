import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export interface CodexExecParams {
  model: string;
  signal?: AbortSignal;
}

function normalizeCodexModel(model: string): string {
  return model.replace(/^codex:/, '');
}

function createCodexPrompt(prompt: string, systemPrompt: string): string {
  return `${systemPrompt}

## Session Constraints

- External Dexter tools are unavailable in this session
- Do not claim to have run tools, fetched live data, or browsed the web
- Answer directly from your built-in knowledge and the prompt context only

## User Request

${prompt}`;
}

async function runCodexCommand(
  args: string[],
  options?: { stdin?: string; signal?: AbortSignal },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: options?.signal,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    if (options?.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

export async function assertCodexCliReady(signal?: AbortSignal): Promise<void> {
  const result = await runCodexCommand(['login', 'status'], { signal });
  const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();

  if (result.code !== 0) {
    throw new Error(combinedOutput || 'Codex CLI is not ready.');
  }

  if (!combinedOutput.toLowerCase().includes('logged in')) {
    throw new Error(combinedOutput || 'Codex CLI is not logged in.');
  }
}

export async function callCodexCli(
  prompt: string,
  systemPrompt: string,
  params: CodexExecParams,
): Promise<string> {
  const outputDir = await mkdtemp(join(tmpdir(), 'dexter-codex-'));
  const outputFile = join(outputDir, 'last-message.txt');

  try {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--output-last-message',
      outputFile,
      '--model',
      normalizeCodexModel(params.model),
      '-',
    ];

    const result = await runCodexCommand(args, {
      signal: params.signal,
      stdin: createCodexPrompt(prompt, systemPrompt),
    });

    if (result.code !== 0) {
      const message = result.stderr || `Codex CLI exited with status ${result.code ?? 'unknown'}.`;
      throw new Error(message);
    }

    const finalMessage = (await readFile(outputFile, 'utf8')).trim();
    if (!finalMessage) {
      throw new Error('Codex CLI returned an empty response.');
    }

    return finalMessage;
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}
