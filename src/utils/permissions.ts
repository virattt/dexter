import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, normalize } from 'path';

const PERMISSIONS_FILE = '.dexter/permissions.json';

export type PermissionOperation = 'read' | 'write';
export type PermissionType = 'file' | 'directory';

export interface Permission {
  path: string;
  type: PermissionType;
  operations: PermissionOperation[];
  grantedAt: string;
}

interface PermissionsData {
  permissions: Permission[];
}

// Paths that should never be accessible
const BLOCKED_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/root',
  '/.ssh',
  '/etc/sudoers',
];

/**
 * Load permissions from disk
 */
export function loadPermissions(): PermissionsData {
  if (!existsSync(PERMISSIONS_FILE)) {
    return { permissions: [] };
  }

  try {
    const content = readFileSync(PERMISSIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { permissions: [] };
  }
}

/**
 * Save permissions to disk
 */
export function savePermissions(data: PermissionsData): boolean {
  try {
    const dir = dirname(PERMISSIONS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a path for comparison (resolve relative paths, remove trailing slashes)
 */
function normalizePath(path: string): string {
  const resolved = resolve(path);
  return normalize(resolved);
}

/**
 * Check if a path is blocked for security reasons
 */
function isBlockedPath(path: string): boolean {
  const normalized = normalizePath(path);
  return BLOCKED_PATHS.some(blocked => {
    const normalizedBlocked = normalize(blocked);
    return normalized === normalizedBlocked || normalized.startsWith(normalizedBlocked + '/');
  });
}

/**
 * Check if a requested path is covered by a granted permission
 */
function isPathCovered(requestedPath: string, grantedPath: string, grantedType: PermissionType): boolean {
  const requested = normalizePath(requestedPath);
  const granted = normalizePath(grantedPath);

  // Exact match
  if (requested === granted) {
    return true;
  }

  // If granted permission is a directory, check if requested path is inside it
  if (grantedType === 'directory') {
    return requested.startsWith(granted + '/');
  }

  return false;
}

/**
 * Check if a path and operation are permitted
 */
export function checkPermission(path: string, operation: PermissionOperation): boolean {
  // Block dangerous paths
  if (isBlockedPath(path)) {
    return false;
  }

  const data = loadPermissions();
  
  return data.permissions.some(permission => {
    return (
      permission.operations.includes(operation) &&
      isPathCovered(path, permission.path, permission.type)
    );
  });
}

/**
 * Grant permission for a path and operation
 */
export function grantPermission(
  path: string,
  type: PermissionType,
  operation: PermissionOperation
): boolean {
  // Never grant blocked paths
  if (isBlockedPath(path)) {
    return false;
  }

  const data = loadPermissions();
  const normalized = normalizePath(path);

  // Find existing permission for this path
  const existing = data.permissions.find(p => normalizePath(p.path) === normalized);

  if (existing) {
    // Add operation if not already present
    if (!existing.operations.includes(operation)) {
      existing.operations.push(operation);
    }
  } else {
    // Create new permission
    data.permissions.push({
      path: normalized,
      type,
      operations: [operation],
      grantedAt: new Date().toISOString(),
    });
  }

  return savePermissions(data);
}

/**
 * Get all granted permissions (for debugging/display)
 */
export function getPermissions(): Permission[] {
  return loadPermissions().permissions;
}

/**
 * Clear all permissions (for testing or reset)
 */
export function clearPermissions(): boolean {
  return savePermissions({ permissions: [] });
}
