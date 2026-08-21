/**
 * Source of a skill definition.
 * - builtin: Shipped with Dexter (src/skills/builtin/)
 * - project: Project-level skills (.dexter/skills/)
 */
export type SkillSource = 'builtin' | 'user' | 'project';

/**
 * Skill metadata - lightweight info loaded at startup for system prompt injection.
 * Contains discovery fields from YAML frontmatter.
 */
export interface SkillMetadata {
  /** Unique skill name (e.g., "dcf") */
  name: string;
  /** Description of when to use this skill */
  description: string;
  /** Absolute path to the SKILL.md file */
  path: string;
  /** Where this skill was discovered from */
  source: SkillSource;
  /** Environment variables where at least one must be configured */
  requiresAnyEnv?: string[];
}

/**
 * Full skill definition with instructions loaded on-demand.
 * Extends metadata with the full SKILL.md body content.
 */
export interface Skill extends SkillMetadata {
  /** Full instructions from SKILL.md body (loaded when skill is invoked) */
  instructions: string;
}
