import { describe } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeTestSkill } from '../test-helpers/skill-smoke.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('sector-overview skill', () => {
  smokeTestSkill(join(__dirname, 'SKILL.md'), [
    'macro',
    'valuation spread',
    'web_search',
    'write_file',
  ]);
});
