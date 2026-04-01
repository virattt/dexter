import { join } from 'node:path';

const SAPIENS_DIR = '.sapiens';

export function getSapiensDir(): string {
  return SAPIENS_DIR;
}

export function sapiensPath(...segments: string[]): string {
  return join(getSapiensDir(), ...segments);
}
