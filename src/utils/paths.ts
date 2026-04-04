import { join } from 'node:path';

const KABUTO_DIR = '.kabuto';

export function getKabutoDir(): string {
  return KABUTO_DIR;
}

export function kabutoPath(...segments: string[]): string {
  return join(getKabutoDir(), ...segments);
}
