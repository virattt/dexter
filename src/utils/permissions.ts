/**
 * File system permission manager.
 *
 * Persists path-based permissions in .dexter/permissions.json so the user
 * only has to grant access once per path.  Permissions are checked before
 * every file tool invocation.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

export type PermissionTool = 'read_file' | 'write_file' | 'edit_file';

export interface PermissionRule {
  /** Tool this rule applies to */
  tool: PermissionTool;
  /** Absolute path (file or directory) */
  path: string;
  /** If true, grants access to all files under `path` */
  recursive: boolean;
}

interface PermissionsFile {
  rules: PermissionRule[];
}

// ============================================================================
// Constants
// ============================================================================

const PERMISSIONS_PATH = '.dexter/permissions.json';

// ============================================================================
// Persistence
// ============================================================================

function loadPermissions(): PermissionsFile {
  if (!existsSync(PERMISSIONS_PATH)) {
    return { rules: [] };
  }
  try {
    const raw = readFileSync(PERMISSIONS_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'rules' in parsed &&
      Array.isArray((parsed as PermissionsFile).rules)
    ) {
      return parsed as PermissionsFile;
    }
    return { rules: [] };
  } catch {
    return { rules: [] };
  }
}

function savePermissions(perms: PermissionsFile): void {
  const dir = dirname(PERMISSIONS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PERMISSIONS_PATH, JSON.stringify(perms, null, 2));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether the given tool is allowed to access `filePath`.
 */
export function checkPermission(tool: PermissionTool, filePath: string): boolean {
  const absPath = resolve(filePath);
  const perms = loadPermissions();

  for (const rule of perms.rules) {
    if (rule.tool !== tool) continue;

    const rulePath = resolve(rule.path);

    // Exact match
    if (absPath === rulePath) return true;

    // Recursive directory match
    if (rule.recursive && absPath.startsWith(rulePath + '/')) return true;
  }

  return false;
}

/**
 * Grant a permission and persist it to disk.
 */
export function grantPermission(tool: PermissionTool, path: string, recursive: boolean): void {
  const absPath = resolve(path);
  const perms = loadPermissions();

  // Avoid duplicates
  const exists = perms.rules.some(
    (r) => r.tool === tool && resolve(r.path) === absPath && r.recursive === recursive,
  );
  if (!exists) {
    perms.rules.push({ tool, path: absPath, recursive });
    savePermissions(perms);
  }
}

/**
 * Check permission and return a structured result the tool can use.
 */
export function requestPermission(
  tool: PermissionTool,
  filePath: string,
): { allowed: boolean; message?: string } {
  if (checkPermission(tool, filePath)) {
    return { allowed: true };
  }

  const absPath = resolve(filePath);
  const parentDir = dirname(absPath);

  return {
    allowed: false,
    message:
      `Permission denied: ${tool} is not allowed to access "${absPath}".\n\n` +
      `To grant access, add a rule to .dexter/permissions.json:\n` +
      `{\n  "rules": [\n    { "tool": "${tool}", "path": "${parentDir}", "recursive": true }\n  ]\n}\n\n` +
      `Or grant access to the specific file:\n` +
      `{ "tool": "${tool}", "path": "${absPath}", "recursive": false }`,
  };
}
