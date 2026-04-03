import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TseMasterProvider } from '../tse-master.js';

// TSE Excel のfetchをモック
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('TseMasterProvider.parseMarket', () => {
  test.each([
    ['東証プライム', 'Prime'],
    ['プライム', 'Prime'],
    ['東証スタンダード', 'Standard'],
    ['東証グロース', 'Growth'],
    ['札幌', 'Other'],
    ['', 'Other'],
  ])('市場名 "%s" → "%s"', (input, expected) => {
    const provider = new TseMasterProvider();
    expect(provider.parseMarket(input)).toBe(expected);
  });
});
