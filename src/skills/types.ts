/**
 * Source of a skill definition.
 * - builtin: Shipped with Dexter (src/skills/builtin/)
 * - project: Project-level skills (.dexter/skills/)
 */
export type SkillSource = 'builtin' | 'user' | 'project';

/**
 * Definition of a single parameter that can be passed to a skill.
 */
export interface SkillParameter {
  type: 'number' | 'string' | 'boolean';
  description: string;
  default?: number | string | boolean;
  /** Only valid when type is 'number' */
  min?: number;
  /** Only valid when type is 'number' */
  max?: number;
  /** Defaults to false when absent */
  required?: boolean;
}

/**
 * Skill metadata - lightweight info loaded at startup for system prompt injection.
 * Only contains the name and description from YAML frontmatter.
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
  /** Optional parameter definitions declared in YAML front-matter */
  parameters?: Record<string, SkillParameter>;
}

/**
 * Full skill definition with instructions loaded on-demand.
 * Extends metadata with the full SKILL.md body content.
 */
export interface Skill extends SkillMetadata {
  /** Full instructions from SKILL.md body (loaded when skill is invoked) */
  instructions: string;
}
