import { join } from 'node:path';

const YASSIR_DIR = '.yassir';

export function getYassirDir(): string {
  return YASSIR_DIR;
}

export function yassirPath(...segments: string[]): string {
  return join(getYassirDir(), ...segments);
}
