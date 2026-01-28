import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import type { SkillMetadata, Skill, SkillSource } from './types.js';
import { extractSkillMetadata, loadSkillFromPath } from './loader.js';

// Get the directory of this file to locate builtin skills
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Skill directories in order of precedence (later overrides earlier).
 */
const SKILL_DIRECTORIES: { path: string; source: SkillSource }[] = [
  { path: __dirname, source: 'builtin' },
  { path: join(homedir(), '.dexter', 'skills'), source: 'user' },
  { path: join(process.cwd(), '.dexter', 'skills'), source: 'project' },
];

// Cache for discovered skills (metadata only)
let skillMetadataCache: Map<string, SkillMetadata> | null = null;

/**
 * Scan a directory for SKILL.md files and return their metadata.
 * Looks for directories containing SKILL.md files.
 *
 * @param dirPath - Directory to scan
 * @param source - Source type for discovered skills
 * @returns Array of skill metadata
 */
function scanSkillDirectory(dirPath: string, source: SkillSource): SkillMetadata[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const skills: SkillMetadata[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFilePath = join(dirPath, entry.name, 'SKILL.md');
      if (existsSync(skillFilePath)) {
        try {
          const metadata = extractSkillMetadata(skillFilePath, source);
          skills.push(metadata);
        } catch {
          // Skip invalid skill files silently
        }
      }
    }
  }

  return skills;
}

/**
 * Discover all available skills from all skill directories.
 * Later sources (project > user > builtin) override earlier ones.
 *
 * @returns Array of skill metadata, deduplicated by name
 */
export function discoverSkills(): SkillMetadata[] {
  if (skillMetadataCache) {
    return Array.from(skillMetadataCache.values());
  }

  skillMetadataCache = new Map();

  for (const { path, source } of SKILL_DIRECTORIES) {
    const skills = scanSkillDirectory(path, source);
    for (const skill of skills) {
      // Later sources override earlier ones (by name)
      skillMetadataCache.set(skill.name, skill);
    }
  }

  return Array.from(skillMetadataCache.values());
}

/**
 * Get a skill by name, loading full instructions.
 *
 * @param name - Name of the skill to load
 * @returns Full skill definition or undefined if not found
 */
export function getSkill(name: string): Skill | undefined {
  // Ensure cache is populated
  if (!skillMetadataCache) {
    discoverSkills();
  }

  const metadata = skillMetadataCache?.get(name);
  if (!metadata) {
    return undefined;
  }

  // Load full skill with instructions
  return loadSkillFromPath(metadata.path, metadata.source);
}

/**
 * Build the skill metadata section for the system prompt.
 * Only includes name and description (lightweight).
 *
 * @returns Formatted string for system prompt injection
 */
export function buildSkillMetadataSection(): string {
  const skills = discoverSkills();

  if (skills.length === 0) {
    return 'No skills available.';
  }

  return skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');
}

/**
 * Clear the skill cache. Useful for testing or when skills are added/removed.
 */
export function clearSkillCache(): void {
  skillMetadataCache = null;
}
