/**
 * Shared smoke-test helper for SKILL.md files.
 *
 * Usage in a skill.test.ts:
 *
 *   import { dirname, join } from 'node:path';
 *   import { fileURLToPath } from 'node:url';
 *   import { smokeTestSkill } from '../test-helpers/skill-smoke.js';
 *
 *   const __dirname = dirname(fileURLToPath(import.meta.url));
 *   smokeTestSkill(join(__dirname, 'SKILL.md'), ['keyword1', 'keyword2']);
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { loadSkillFromPath } from '../loader.js';
import { discoverSkills, clearSkillCache } from '../registry.js';
import type { Skill } from '../types.js';

export function smokeTestSkill(skillPath: string, expectedKeywords: string[]): void {
  let skill: Skill;

  describe('skill structure', () => {
    beforeEach(() => {
      skill = loadSkillFromPath(skillPath, 'builtin');
    });

    it('loads from SKILL.md without error', () => {
      expect(skill).toBeDefined();
    });

    it('has a non-empty name', () => {
      expect(typeof skill.name).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
    });

    it('has a non-empty description', () => {
      expect(typeof skill.description).toBe('string');
      expect(skill.description.length).toBeGreaterThan(0);
    });

    it('has non-empty instructions body', () => {
      expect(typeof skill.instructions).toBe('string');
      expect(skill.instructions.length).toBeGreaterThan(0);
    });

    for (const keyword of expectedKeywords) {
      it(`instructions contain "${keyword}"`, () => {
        expect(skill.instructions.toLowerCase()).toContain(keyword.toLowerCase());
      });
    }

    it('is discoverable via discoverSkills()', () => {
      clearSkillCache();
      const skills = discoverSkills();
      expect(skills.some((s) => s.name === skill.name)).toBe(true);
      clearSkillCache();
    });
  });
}
