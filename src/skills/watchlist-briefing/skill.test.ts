import { describe } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeTestSkill } from '../test-helpers/skill-smoke.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('watchlist-briefing skill', () => {
  smokeTestSkill(join(__dirname, 'SKILL.md'), [
    'get_market_data',
    'get_financials',
    'P&L',
    'earnings',
  ]);
});
