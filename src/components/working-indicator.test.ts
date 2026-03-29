import { describe, it, expect } from 'bun:test';
import { buildProgressBar } from './working-indicator.js';

describe('buildProgressBar', () => {
  it('0% → all empty blocks', () => {
    expect(buildProgressBar(0, 25)).toBe('░░░░░░░░░░ 0%');
  });

  it('100% → all filled blocks', () => {
    expect(buildProgressBar(25, 25)).toBe('██████████ 100%');
  });

  it('7/25 → 28% with some filled blocks', () => {
    const result = buildProgressBar(7, 25);
    // 7/25 = 0.28 → 3 filled out of 10, label 28%
    expect(result).toBe('███░░░░░░░ 28%');
    expect(result).toContain('28%');
    expect(result.startsWith('█')).toBe(true);
  });

  it('12/25 → roughly half filled', () => {
    const result = buildProgressBar(12, 25);
    // 12/25 = 0.48 → 5 filled out of 10 (round(0.48*10)=5), label 48%
    expect(result).toBe('█████░░░░░ 48%');
  });

  it('respects custom width', () => {
    const result = buildProgressBar(1, 4, 4);
    // 1/4 = 0.25 → 1 filled out of 4, label 25%
    expect(result).toBe('█░░░ 25%');
  });

  it('clamps at 100% when iteration exceeds max', () => {
    const result = buildProgressBar(30, 25);
    expect(result).toBe('██████████ 100%');
  });
});
