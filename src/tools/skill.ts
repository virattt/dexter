import { DynamicStructuredTool } from '@langchain/core/tools';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { getSkill, discoverSkills } from '../skills/index.js';
import type { SkillParameter } from '../skills/types.js';

/**
 * Rich description for the skill tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const SKILL_TOOL_DESCRIPTION = `
Execute a skill to get specialized instructions for complex tasks.

## When to Use

- When the user's query matches an available skill's description
- For complex workflows that benefit from structured guidance (e.g., DCF valuation, financial reports)
- When you need step-by-step instructions for a specialized task

## When NOT to Use

- For simple queries that don't require specialized workflows
- When no available skill matches the task
- If you've already invoked the skill for this query (don't invoke twice)

## Usage Notes

- Invoke the skill IMMEDIATELY when relevant, as your first action
- The skill returns instructions that you should follow to complete the task
- Use the skill name exactly as listed in Available Skills
- Pass any relevant arguments (like ticker symbols) via the args parameter
`.trim();

/**
 * Resolve and validate parameters against their definitions.
 * Returns resolved values or an error string if validation fails.
 */
function resolveParams(
  defs: Record<string, SkillParameter>,
  provided: Record<string, string | number | boolean> | undefined,
): { resolved: Record<string, string | number | boolean>; sources: Record<string, 'override' | 'default'>; error?: string } {
  const resolved: Record<string, string | number | boolean> = {};
  const sources: Record<string, 'override' | 'default'> = {};

  for (const [paramName, def] of Object.entries(defs)) {
    const raw = provided?.[paramName];
    if (raw !== undefined) {
      if (def.type === 'number') {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          return { resolved, sources, error: `Parameter "${paramName}" must be a number, got: ${String(raw)}` };
        }
        if (def.min !== undefined && num < def.min) {
          return { resolved, sources, error: `Parameter "${paramName}" must be >= ${def.min}, got: ${num}` };
        }
        if (def.max !== undefined && num > def.max) {
          return { resolved, sources, error: `Parameter "${paramName}" must be <= ${def.max}, got: ${num}` };
        }
        resolved[paramName] = num;
      } else {
        resolved[paramName] = raw;
      }
      sources[paramName] = 'override';
    } else if (def.default !== undefined) {
      resolved[paramName] = def.default;
      sources[paramName] = 'default';
    } else if (def.required) {
      return { resolved, sources, error: `Required parameter "${paramName}" was not provided` };
    }
  }

  return { resolved, sources };
}

/**
 * Replace {{paramName}} placeholders in text with resolved values.
 */
function applyPlaceholders(text: string, resolved: Record<string, string | number | boolean>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return key in resolved ? String(resolved[key]) : _match;
  });
}

/**
 * Skill invocation tool.
 * Loads and returns skill instructions for the agent to follow.
 */
export const skillTool = new DynamicStructuredTool({
  name: 'skill',
  description: 'Execute a skill to get specialized instructions for a task. Returns instructions to follow.',
  schema: z.object({
    skill: z.string().describe('Name of the skill to invoke (e.g., "dcf")'),
    args: z.string().optional().describe('Optional arguments for the skill (e.g., ticker symbol)'),
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe('Optional parameters to override skill defaults, e.g. {"wacc": 0.12, "growth_rate": 0.05}'),
  }),
  func: async ({ skill, args, params }) => {
    const skillDef = getSkill(skill);

    if (!skillDef) {
      const available = discoverSkills().map((s) => s.name).join(', ');
      return `Error: Skill "${skill}" not found. Available skills: ${available || 'none'}`;
    }

    // Resolve parameters if the skill declares any
    let resolvedParams: Record<string, string | number | boolean> = {};
    let paramSources: Record<string, 'override' | 'default'> = {};
    if (skillDef.parameters && Object.keys(skillDef.parameters).length > 0) {
      const result = resolveParams(skillDef.parameters, params as Record<string, string | number | boolean> | undefined);
      if (result.error) {
        return `Error: ${result.error}`;
      }
      resolvedParams = result.resolved;
      paramSources = result.sources;
    }

    // Return instructions with optional args context
    let result = `## Skill: ${skillDef.name}\n\n`;
    
    if (args) {
      result += `**Arguments provided:** ${args}\n\n`;
    }

    // Append active parameters section when any were resolved
    if (Object.keys(resolvedParams).length > 0) {
      result += `## Active Parameters\n`;
      for (const [key, value] of Object.entries(resolvedParams)) {
        const source = paramSources[key] === 'override' ? '(override)' : '(default)';
        result += `- ${key}: ${String(value)} ${source}\n`;
      }
      result += '\n';
    }
    
    // Resolve relative markdown links to absolute paths so the agent's
    // read_file tool can find referenced files (e.g., sector-wacc.md).
    const skillDir = dirname(skillDef.path);
    let instructions = skillDef.instructions.replace(
      /\[([^\]]+)\]\(([^)]+\.md)\)/g,
      (_match, label, relPath) => {
        if (relPath.startsWith('/') || relPath.startsWith('http')) return _match;
        return `[${label}](${resolve(skillDir, relPath)})`;
      },
    );

    // Replace {{paramName}} placeholders with resolved values
    if (Object.keys(resolvedParams).length > 0) {
      instructions = applyPlaceholders(instructions, resolvedParams);
    }

    result += instructions;

    return result;
  },
});
