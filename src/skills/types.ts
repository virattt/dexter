/**
 * Source of a skill definition.
 * - builtin: Shipped with Dexter (src/skills/builtin/)
 * - user: User-level skills (~/.dexter/skills/)
 * - project: Project-level skills (.dexter/skills/)
 */
export type SkillSource = 'builtin' | 'user' | 'project';

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
  /**
   * Optional override for the agent's max iterations when this skill is active.
   * Useful for complex multi-step skills (e.g., DCF valuation) that need more iterations.
   * Falls back to the agent's default (10) if not specified.
   */
  maxIterations?: number;
}

/**
 * Full skill definition with instructions loaded on-demand.
 * Extends metadata with the full SKILL.md body content.
 */
export interface Skill extends SkillMetadata {
  /** Full instructions from SKILL.md body (loaded when skill is invoked) */
  instructions: string;
}
