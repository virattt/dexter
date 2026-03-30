import { describe, test, expect, beforeEach } from 'bun:test';
import { createSkillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import type { Skill, SkillMetadata } from '../skills/types.js';

// Injectable mock functions — reset before each test via beforeEach
let mockGetSkillFn: (name: string) => Skill | undefined = () => undefined;
let mockDiscoverSkillsFn: () => SkillMetadata[] = () => [];

// createSkillTool receives closures so reassigning the let-variables above
// inside individual tests is picked up by the already-created tool.
let skillTool = createSkillTool(
  (name) => mockGetSkillFn(name),
  () => mockDiscoverSkillsFn(),
);

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'dcf',
    description: 'DCF valuation workflow',
    path: '/home/user/.dexter/skills/dcf/SKILL.md',
    source: 'builtin',
    instructions: 'Step 1: Gather revenue data.\nStep 2: Estimate WACC.',
    parameters: {},
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSkillFn = () => undefined;
  mockDiscoverSkillsFn = () => [];
  // Recreate so each test starts fresh (closures re-bound to current variables)
  skillTool = createSkillTool(
    (name) => mockGetSkillFn(name),
    () => mockDiscoverSkillsFn(),
  );
});

describe('SKILL_TOOL_DESCRIPTION', () => {
  test('is a non-empty string', () => {
    expect(typeof SKILL_TOOL_DESCRIPTION).toBe('string');
    expect(SKILL_TOOL_DESCRIPTION.length).toBeGreaterThan(0);
  });
});

describe('skillTool — skill not found', () => {
  test('returns error with skill name when skill not found', async () => {
    const result = await skillTool.invoke({ skill: 'unknown' });
    expect(result).toContain('unknown');
    expect(result.toLowerCase()).toContain('not found');
  });

  test('includes available skills in error message', async () => {
    mockDiscoverSkillsFn = () => [
      { name: 'dcf', description: 'DCF val', path: '/dcf/SKILL.md', source: 'builtin' },
      { name: 'report', description: 'Report gen', path: '/report/SKILL.md', source: 'builtin' },
    ];
    const result = await skillTool.invoke({ skill: 'missing' });
    expect(result).toContain('dcf');
    expect(result).toContain('report');
  });

  test('says "none" when no skills are discovered', async () => {
    const result = await skillTool.invoke({ skill: 'ghost' });
    expect(result).toContain('none');
  });
});

describe('skillTool — skill found, no parameters', () => {
  test('returns skill name header in result', async () => {
    mockGetSkillFn = () => makeSkill();
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('dcf');
  });

  test('includes skill instructions in result', async () => {
    mockGetSkillFn = () => makeSkill({ instructions: 'Gather financial data.' });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('Gather financial data.');
  });

  test('includes args in result when provided', async () => {
    mockGetSkillFn = () => makeSkill();
    const result = await skillTool.invoke({ skill: 'dcf', args: 'AAPL' });
    expect(result).toContain('AAPL');
  });

  test('does not include args section when args not provided', async () => {
    mockGetSkillFn = () => makeSkill();
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).not.toContain('Arguments provided');
  });
});

describe('skillTool — parameter resolution', () => {
  test('uses default parameter values when params not provided', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC rate', default: 0.1 },
        },
        instructions: 'Use WACC of {{wacc}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('0.1');
  });

  test('uses override param when provided', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC rate', default: 0.1 },
        },
        instructions: 'Use WACC of {{wacc}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf', params: { wacc: 0.12 } });
    expect(result).toContain('0.12');
  });

  test('returns error for required param not provided', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          ticker: { type: 'string', description: 'Stock ticker', required: true },
        },
        instructions: 'Analyze {{ticker}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result.toLowerCase()).toContain('error');
    expect(result).toContain('ticker');
  });

  test('returns error when number param is below min', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          rate: { type: 'number', description: 'Rate', default: 0.05, min: 0, max: 1 },
        },
        instructions: 'Rate: {{rate}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf', params: { rate: -0.1 } });
    expect(result.toLowerCase()).toContain('error');
  });

  test('returns error when number param is above max', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          rate: { type: 'number', description: 'Rate', default: 0.05, min: 0, max: 1 },
        },
        instructions: 'Rate: {{rate}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf', params: { rate: 1.5 } });
    expect(result.toLowerCase()).toContain('error');
  });

  test('returns error when number param is non-finite', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          rate: { type: 'number', description: 'Rate', default: 0.05 },
        },
        instructions: 'Rate: {{rate}}.',
      });
    // Pass a string that can't be coerced to a finite number
    const result = await skillTool.invoke({ skill: 'dcf', params: { rate: 'not-a-number' } });
    expect(result.toLowerCase()).toContain('error');
  });

  test('shows active parameters section in output', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC', default: 0.1 },
        },
        instructions: 'WACC: {{wacc}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('Active Parameters');
    expect(result).toContain('wacc');
  });

  test('marks param source as (override) when user provides it', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC', default: 0.1 },
        },
        instructions: 'WACC: {{wacc}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf', params: { wacc: 0.12 } });
    expect(result).toContain('(override)');
  });

  test('marks param source as (default) when default is used', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC', default: 0.1 },
        },
        instructions: 'WACC: {{wacc}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('(default)');
  });

  test('replaces {{placeholder}} not in params with original placeholder', async () => {
    mockGetSkillFn = () =>
      makeSkill({
        parameters: {
          wacc: { type: 'number', description: 'WACC', default: 0.1 },
        },
        instructions: 'WACC: {{wacc}}. Other: {{unknown}}.',
      });
    const result = await skillTool.invoke({ skill: 'dcf' });
    expect(result).toContain('{{unknown}}');
  });
});
