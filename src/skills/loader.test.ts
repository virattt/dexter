import { describe, expect, test } from 'bun:test';
import { parseSkillFile } from './loader.js';

describe('skill availability metadata', () => {
  test('parses alternative environment requirements', () => {
    const skill = parseSkillFile(
      `---
name: research
description: Test research Skill.
requiresAnyEnv:
  - FIRST_API_KEY
  - SECOND_API_KEY
---
Use the available provider.
`,
      '/tmp/research/SKILL.md',
      'project',
    );

    expect(skill.requiresAnyEnv).toEqual(['FIRST_API_KEY', 'SECOND_API_KEY']);
    expect(skill.instructions).toBe('Use the available provider.');
  });

  test('rejects malformed environment requirements', () => {
    expect(() => parseSkillFile(
      `---
name: research
description: Test research Skill.
requiresAnyEnv: FIRST_API_KEY
---
Instructions.
`,
      '/tmp/research/SKILL.md',
      'project',
    )).toThrow("invalid 'requiresAnyEnv'");
  });
});
