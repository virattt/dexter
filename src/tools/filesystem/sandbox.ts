import { lstat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { resolveToCwd } from './utils/path-utils.js';

export function resolveSandboxPath(params: { filePath: string; cwd: string; root: string }): {
  resolved: string;
  relative: string;
} {
  const resolved = resolveToCwd(params.filePath, params.cwd);
  const rootResolved = resolvePath(params.root);
  const rel = relative(rootResolved, resolved);

  if (!rel || rel === '') {
    return { resolved, relative: '' };
  }

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes sandbox root: ${params.filePath}`);
  }

  return { resolved, relative: rel };
}

export async function assertSandboxPath(params: {
  filePath: string;
  cwd: string;
  root?: string;
}): Promise<{ resolved: string; relative: string }> {
  const root = params.root ?? params.cwd;
  const resolved = resolveSandboxPath({ filePath: params.filePath, cwd: params.cwd, root });
  await assertNoSymlink(resolved.relative, resolvePath(root));
  return resolved;
}

async function assertNoSymlink(relativePath: string, root: string): Promise<void> {
  if (!relativePath) {
    return;
  }

  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symlink not allowed in sandbox path: ${current}`);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ENOENT') {
        return;
      }
      throw err;
    }
  }
}
