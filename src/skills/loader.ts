import { readFileSync } from 'fs';
import matter from 'gray-matter';
import type { Skill, SkillMetadata, SkillSource } from './types.js';

function parseMetadata(
  data: Record<string, unknown>,
  path: string,
  source: SkillSource,
): SkillMetadata {
  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'name' field in frontmatter`);
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'description' field in frontmatter`);
  }
  if (
    data.requiresAnyEnv !== undefined &&
    (!Array.isArray(data.requiresAnyEnv) ||
      data.requiresAnyEnv.length === 0 ||
      data.requiresAnyEnv.some((name) => typeof name !== 'string' || !name))
  ) {
    throw new Error(`Skill at ${path} has an invalid 'requiresAnyEnv' field`);
  }

  return {
    name: data.name,
    description: data.description,
    path,
    source,
    ...(data.requiresAnyEnv ? { requiresAnyEnv: data.requiresAnyEnv as string[] } : {}),
  };
}

/**
 * Parse a SKILL.md file content into a Skill object.
 * Extracts YAML frontmatter (name, description) and the markdown body (instructions).
 *
 * @param content - Raw file content
 * @param path - Absolute path to the file (for reference)
 * @param source - Where this skill came from
 * @returns Parsed Skill object
 * @throws Error if required frontmatter fields are missing
 */
export function parseSkillFile(content: string, path: string, source: SkillSource): Skill {
  const { data, content: instructions } = matter(content);

  return {
    ...parseMetadata(data, path, source),
    instructions: instructions.trim(),
  };
}

/**
 * Load a skill from a file path.
 *
 * @param path - Absolute path to the SKILL.md file
 * @param source - Where this skill came from
 * @returns Parsed Skill object
 * @throws Error if file cannot be read or parsed
 */
export function loadSkillFromPath(path: string, source: SkillSource): Skill {
  const content = readFileSync(path, 'utf-8');
  return parseSkillFile(content, path, source);
}

/**
 * Extract just the metadata from a skill file without loading full instructions.
 * Used for lightweight discovery at startup.
 *
 * @param path - Absolute path to the SKILL.md file
 * @param source - Where this skill came from
 * @returns Skill metadata (name, description, path, source)
 */
export function extractSkillMetadata(path: string, source: SkillSource): SkillMetadata {
  const content = readFileSync(path, 'utf-8');
  const { data } = matter(content);
  return parseMetadata(data, path, source);
}
