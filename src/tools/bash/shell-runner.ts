/**
 * Shell runner for the bash tool.
 *
 * Spawns `/bin/sh -c <command>` and captures stdout/stderr with:
 *  - an absolute timeout (independent of the LLM),
 *  - external AbortSignal cancellation,
 *  - a hard output byte-cap, and
 *  - **process-group tree-kill**: the child is started detached (its own process
 *    group leader) so a runaway command's children/grandchildren are reaped too —
 *    `child.kill()` alone would only reap the `/bin/sh` parent and leak the rest.
 *
 * Uses node:child_process (fully supported under Bun) rather than Bun.spawn,
 * because Bun.spawn has no `detached` option and therefore no real process group.
 *
 * Safety invariants:
 *  - never signals the process group after the result has settled (avoids hitting
 *    a recycled PID belonging to an unrelated process group);
 *  - never rejects — spawn failures are reported in the result;
 *  - never hangs — an unkillable child force-resolves via a post-SIGKILL watchdog.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const MAX_TIMEOUT_MS = 600_000;
/** Hard output ceiling per stream — well above the 50KB tool-result persistence threshold. */
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
const KILL_GRACE_MS = 500;
/** After SIGKILL, force-resolve if the process still hasn't closed (unkillable / D-state). */
const FORCE_RESOLVE_MS = 2_000;

export interface ShellResult {
  stdout: string;
  stderr: string;
  /** Process exit code, or null if it was killed / failed to spawn. */
  exitCode: number | null;
  /** Signal that terminated the process, if any. */
  signal: NodeJS.Signals | null;
  /** True if we killed it (timeout, abort, or output overflow). */
  interrupted: boolean;
  /** True if the absolute timeout fired. */
  timedOut: boolean;
  /** True if output hit the byte cap and the command was killed. */
  truncated: boolean;
  durationMs: number;
}

export interface RunShellOptions {
  cwd?: string;
  /** Absolute timeout in ms (clamped to [1, MAX_TIMEOUT_MS]). Default 120s. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Called per output chunk for live streaming. */
  onData?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  maxOutputBytes?: number;
}

/**
 * Run a shell command to completion (or until killed). Never rejects — failures
 * (including spawn errors) are reported in the returned {@link ShellResult}.
 */
export function runShell(command: string, options: RunShellOptions = {}): Promise<ShellResult> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1), MAX_TIMEOUT_MS);
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const start = Date.now();

  return new Promise<ShellResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn('/bin/sh', ['-c', command], {
        detached: true, // own process group → tree-kill via negative PID
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: options.cwd,
      });
    } catch (err) {
      resolve({
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: null,
        signal: null,
        interrupted: false,
        timedOut: false,
        truncated: false,
        durationMs: Date.now() - start,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    let interrupted = false;
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const outDecoder = new StringDecoder('utf8');
    const errDecoder = new StringDecoder('utf8');

    const killGroup = (sig: NodeJS.Signals) => {
      if (settled) return; // never signal a (possibly recycled) PID after we've resolved
      const pid = child.pid;
      if (pid === undefined) return;
      try {
        process.kill(-pid, sig); // negative pid → whole process group
      } catch {
        try {
          child.kill(sig);
        } catch {
          /* already dead */
        }
      }
    };

    const finish = (exitCode: number | null, sig: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
      if (watchdog) clearTimeout(watchdog);
      options.signal?.removeEventListener('abort', onAbort);
      stdout += outDecoder.end();
      stderr += errDecoder.end();
      resolve({
        stdout,
        stderr,
        exitCode,
        signal: sig,
        interrupted,
        timedOut,
        truncated,
        durationMs: Date.now() - start,
      });
    };

    const terminate = () => {
      if (settled || graceTimer) return; // idempotent
      killGroup('SIGTERM');
      graceTimer = setTimeout(() => {
        killGroup('SIGKILL');
        // If the process is unkillable and never closes, don't hang the caller.
        watchdog = setTimeout(() => finish(null, null), FORCE_RESOLVE_MS);
        watchdog.unref?.();
      }, KILL_GRACE_MS);
      graceTimer.unref?.();
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      interrupted = true;
      terminate();
    }, timeoutMs);
    timeoutTimer.unref?.();

    function onAbort() {
      interrupted = true;
      terminate();
    }
    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    const append = (buf: Buffer, which: 'stdout' | 'stderr') => {
      if (which === 'stdout') {
        if (stdoutBytes < maxOutputBytes) {
          const room = maxOutputBytes - stdoutBytes;
          stdout += outDecoder.write(buf.length <= room ? buf : buf.subarray(0, room));
        }
        stdoutBytes += buf.length;
      } else {
        if (stderrBytes < maxOutputBytes) {
          const room = maxOutputBytes - stderrBytes;
          stderr += errDecoder.write(buf.length <= room ? buf : buf.subarray(0, room));
        }
        stderrBytes += buf.length;
      }
      options.onData?.(buf.toString('utf8'), which);
      if (!truncated && (stdoutBytes > maxOutputBytes || stderrBytes > maxOutputBytes)) {
        truncated = true;
        interrupted = true;
        terminate();
      }
    };

    child.stdout?.on('data', (b: Buffer) => append(b, 'stdout'));
    child.stderr?.on('data', (b: Buffer) => append(b, 'stderr'));
    child.on('error', (err: Error) => {
      stderr += (stderr ? '\n' : '') + err.message;
      finish(null, null);
    });
    child.on('close', (code, sig) => finish(code, sig));
  });
}
