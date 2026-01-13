import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { StructuredToolInterface } from '@langchain/core/tools';
import type { Skill } from './types.js';

// Skills directory is always relative to this module
const SKILLS_DIR = join(import.meta.dir, 'skills');

// Import all available tools
import {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
  tavilySearch,
} from '../tools/index.js';

/**
 * Registry of all available tools by name
 */
const TOOL_REGISTRY: Record<string, StructuredToolInterface> = {
  get_income_statements: getIncomeStatements,
  get_balance_sheets: getBalanceSheets,
  get_cash_flow_statements: getCashFlowStatements,
  get_all_financial_statements: getAllFinancialStatements,
  get_filings: getFilings,
  get_10k_filing_items: get10KFilingItems,
  get_10q_filing_items: get10QFilingItems,
  get_8k_filing_items: get8KFilingItems,
  get_price_snapshot: getPriceSnapshot,
  get_prices: getPrices,
  get_crypto_price_snapshot: getCryptoPriceSnapshot,
  get_crypto_prices: getCryptoPrices,
  get_crypto_tickers: getCryptoTickers,
  get_financial_metrics_snapshot: getFinancialMetricsSnapshot,
  get_financial_metrics: getFinancialMetrics,
  get_news: getNews,
  get_analyst_estimates: getAnalystEstimates,
  get_segmented_revenues: getSegmentedRevenues,
  get_insider_trades: getInsiderTrades,
  tavily_search: tavilySearch,
};

/**
 * Parsed frontmatter from SKILL.md
 */
interface SkillFrontmatter {
  name: string;
  description: string;
  tools: string[];
}

/**
 * Load a single skill from its SKILL.md file
 */
async function loadSkill(skillDir: string): Promise<Skill | null> {
  const skillPath = join(skillDir, 'SKILL.md');
  
  let content: string;
  try {
    content = await readFile(skillPath, 'utf-8');
  } catch {
    return null;
  }
  const { data, content: instructions } = matter(content);
  const frontmatter = data as SkillFrontmatter;
  
  if (!frontmatter.name || !frontmatter.description || !frontmatter.tools) {
    console.warn(`Invalid SKILL.md in ${skillDir}: missing required fields`);
    return null;
  }
  
  // Resolve tool names to actual tool instances
  const tools: StructuredToolInterface[] = [];
  for (const toolName of frontmatter.tools) {
    const tool = TOOL_REGISTRY[toolName];
    if (tool) {
      tools.push(tool);
    } else {
      console.warn(`Tool not found: ${toolName}`);
    }
  }
  
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    toolNames: frontmatter.tools,
    tools,
    instructions: instructions.trim(),
  };
}

/**
 * Load all skills from the bundled skills directory
 */
export async function loadSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skill = await loadSkill(join(SKILLS_DIR, entry.name));
      if (skill) {
        skills.push(skill);
      }
    }
  }
  
  return skills;
}

/**
 * Get all tools from loaded skills
 */
export function getToolsFromSkills(skills: Skill[]): StructuredToolInterface[] {
  const tools: StructuredToolInterface[] = [];
  const seen = new Set<string>();
  
  for (const skill of skills) {
    for (const tool of skill.tools) {
      if (!seen.has(tool.name)) {
        tools.push(tool);
        seen.add(tool.name);
      }
    }
  }
  
  return tools;
}

/**
 * Build a system prompt section from skill metadata
 */
export function buildSkillsPromptSection(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }
  
  const sections = skills.map(skill => {
    return `## ${skill.name}
${skill.description}

${skill.instructions}`;
  });
  
  return `# Available Skills

${sections.join('\n\n')}`;
}

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const tool = TOOL_REGISTRY[toolName];
  
  if (!tool) {
    return `Error: Tool '${toolName}' not found`;
  }
  
  try {
    const result = await tool.invoke(args);
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing ${toolName}: ${message}`;
  }
}
