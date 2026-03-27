import { describe } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeTestSkill } from '../test-helpers/skill-smoke.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('earnings-preview skill', () => {
  smokeTestSkill(join(__dirname, 'SKILL.md'), [
    'consensus',
    'guidance',
    'implied move',
    'write_file',
  ]);
});
