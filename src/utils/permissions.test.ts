import { describe, test, expect, beforeEach } from 'bun:test';
import { existsSync, unlinkSync } from 'fs';
import {
  checkPermission,
  grantPermission,
  getPermissions,
  clearPermissions,
} from './permissions.js';

const PERMISSIONS_FILE = '.dexter/permissions.json';

describe('permissions', () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(PERMISSIONS_FILE)) {
      unlinkSync(PERMISSIONS_FILE);
    }
    clearPermissions();
  });

  test('should deny permission by default', () => {
    expect(checkPermission('/tmp/test.txt', 'read')).toBe(false);
  });

  test('should grant and check file permission', () => {
    const granted = grantPermission('/tmp/test.txt', 'file', 'read');
    expect(granted).toBe(true);
    expect(checkPermission('/tmp/test.txt', 'read')).toBe(true);
  });

  test('should not grant permission for different operation', () => {
    grantPermission('/tmp/test.txt', 'file', 'read');
    expect(checkPermission('/tmp/test.txt', 'write')).toBe(false);
  });

  test('should grant directory permission for nested files', () => {
    grantPermission('/tmp/docs', 'directory', 'read');
    expect(checkPermission('/tmp/docs/file.txt', 'read')).toBe(true);
    expect(checkPermission('/tmp/docs/nested/file.txt', 'read')).toBe(true);
  });

  test('should not grant permission outside directory', () => {
    grantPermission('/tmp/docs', 'directory', 'read');
    expect(checkPermission('/tmp/other/file.txt', 'read')).toBe(false);
  });

  test('should block dangerous paths', () => {
    const granted = grantPermission('/etc/passwd', 'file', 'read');
    expect(granted).toBe(false);
    expect(checkPermission('/etc/passwd', 'read')).toBe(false);
  });

  test('should persist permissions', () => {
    grantPermission('/tmp/test.txt', 'file', 'read');
    const permissions = getPermissions();
    expect(permissions.length).toBe(1);
    expect(permissions[0].path).toContain('test.txt');
    expect(permissions[0].operations).toContain('read');
  });

  test('should add operation to existing permission', () => {
    grantPermission('/tmp/test.txt', 'file', 'read');
    grantPermission('/tmp/test.txt', 'file', 'write');
    
    const permissions = getPermissions();
    expect(permissions.length).toBe(1);
    expect(permissions[0].operations).toContain('read');
    expect(permissions[0].operations).toContain('write');
  });

  test('should clear all permissions', () => {
    grantPermission('/tmp/test.txt', 'file', 'read');
    expect(getPermissions().length).toBe(1);
    
    clearPermissions();
    expect(getPermissions().length).toBe(0);
  });
});
