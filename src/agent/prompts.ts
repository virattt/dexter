import { buildToolDescriptions } from '../tools/registry.js';
import { buildSkillMetadataSection, discoverSkills } from '../skills/index.js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChannelProfile } from './channels.js';
import { dexterPath } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the current date formatted for prompts.
 */
export function getCurrentDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('en-US', options);
}

/**
 * Load SOUL.md content from user override or bundled file.
 */
export async function loadSoulDocument(): Promise<string | null> {
  const userSoulPath = dexterPath('SOUL.md');
  try {
    return await readFile(userSoulPath, 'utf-8');
  } catch {
    // Continue to bundled fallback when user override is missing/unreadable.
  }

  const bundledSoulPath = join(__dirname, '../../SOUL.md');
  try {
    return await readFile(bundledSoulPath, 'utf-8');
  } catch {
    // SOUL.md is optional; keep prompt behavior unchanged when absent.
  }

  return null;
}

/**
 * Build the skills section for the system prompt.
 * Only includes skill metadata if skills are available.
 */
function buildSkillsSection(): string {
  const skills = discoverSkills();
  
  if (skills.length === 0) {
    return '';
  }

  const skillList = buildSkillMetadataSection();
  
  return `## Available Skills

${skillList}

## Skill Usage Policy

- Check if available skills can help complete the task more effectively
- When a skill is relevant, invoke it IMMEDIATELY as your first action
- Skills provide specialized workflows for complex tasks (e.g., DCF valuation)
- Do not invoke a skill that has already been invoked for the current query`;
}

function buildMemorySection(memoryFiles: string[], memoryContext?: string | null): string {
  const fileListSection = memoryFiles.length > 0
    ? `\nMemory files on disk: ${memoryFiles.join(', ')}`
    : '';

  const contextSection = memoryContext
    ? `\n\n### What you know about the user\n\n${memoryContext}`
    : '';

  return `## Memory

You have persistent memory stored as Markdown files in .dexter/memory/.${fileListSection}${contextSection}

### Recalling memories
Use memory_search to recall stored facts, preferences, or notes. The search covers all
memory files (long-term and daily logs) AND past conversation transcripts.

**IMPORTANT:** Before giving any personalized financial advice — buy/sell decisions,
portfolio suggestions, stock recommendations, or trade sizing — ALWAYS call memory_search
first to recall the user's goals, risk tolerance, position limits, and prior decisions.
The user expects you to know them. Do not give generic advice when personalized context exists.

Follow up with memory_get to read full sections when you need exact text.

### Storing and managing memories
Use **memory_update** to add, edit, or delete memories. Do NOT use write_file or
edit_file for memory files.
- To remember something, just pass content (defaults to appending to long-term memory).
- For daily notes, pass file="daily".
- For edits/deletes, pass action="edit" or action="delete" with old_text.
Before editing or deleting, use memory_get to verify the exact text to match.`;
}

function buildPassiveMemorySection(memoryFiles: string[], memoryContext?: string | null): string {
  if (memoryFiles.length === 0 && !memoryContext) {
    return '';
  }

  const fileListSection = memoryFiles.length > 0
    ? `\nMemory files on disk: ${memoryFiles.join(', ')}`
    : '';

  const contextSection = memoryContext
    ? `\n\n### What you know about the user\n\n${memoryContext}`
    : '';

  return `## Memory Context

You have read-only memory context loaded for this session.${fileListSection}${contextSection}`;
}

// ============================================================================
// Default System Prompt (for backward compatibility)
// ============================================================================

/**
 * Default system prompt used when no specific prompt is provided.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Dexter, a helpful AI assistant.

Current date: ${getCurrentDate()}

Your output is displayed on a command line interface. Keep responses short and concise.

## Behavior

- Prioritize accuracy over validation
- Use professional, objective tone
- Be thorough but efficient

## Response Format

- Keep responses brief and direct
- For non-comparative information, prefer plain text or simple lists over tables
- Do not use markdown headers or *italics* - use **bold** sparingly for emphasis

## Tables (for comparative/tabular data)

Use markdown tables. They will be rendered as formatted box tables.

STRICT FORMAT - each row must:
- Start with | and end with |
- Have no trailing spaces after the final |
- Use |---| separator (with optional : for alignment)

| Ticker | Rev    | OM  |
|--------|--------|-----|
| AAPL   | 416.2B | 31% |

Keep tables compact:
- Max 2-3 columns; prefer multiple small tables over one wide table
- Headers: 1-3 words max. "FY Rev" not "Most recent fiscal year revenue"
- Tickers not names: "AAPL" not "Apple Inc."
- Abbreviate: Rev, Op Inc, Net Inc, OCF, FCF, GM, OM, EPS
- Numbers compact: 102.5B not $102,466,000,000
- Omit units in cells if header has them`;

// ============================================================================
// Group Chat Context
// ============================================================================

export type GroupContext = {
  groupName?: string;
  membersList?: string;
  activationMode: 'mention';
};

/**
 * Build a system prompt section for group chat context.
 */
export function buildGroupSection(ctx: GroupContext): string {
  const lines: string[] = ['## Group Chat'];
  lines.push('');
  if (ctx.groupName) {
    lines.push(`You are participating in the WhatsApp group "${ctx.groupName}".`);
  } else {
    lines.push('You are participating in a WhatsApp group chat.');
  }
  lines.push('You were activated because someone @-mentioned you.');
  lines.push('');
  lines.push('### Group behavior');
  lines.push('- Address the person who mentioned you by name');
  lines.push('- Reference recent group context when relevant');
  lines.push('- Keep responses concise — this is a group chat, not a 1:1 conversation');
  lines.push('- Do not repeat information that was already shared in the group');

  if (ctx.membersList) {
    lines.push('');
    lines.push('### Group members');
    lines.push(ctx.membersList);
  }

  return lines.join('\n');
}

// ============================================================================
// System Prompt
// ============================================================================

/**
 * Build the system prompt for the agent.
 * @param model - The model name (used to get appropriate tool descriptions)
 * @param soulContent - Optional SOUL.md identity content
 * @param channel - Delivery channel (e.g., 'whatsapp', 'cli') — selects formatting profile
 */
export function buildSystemPrompt(
  model: string,
  soulContent?: string | null,
  channel?: string,
  groupContext?: GroupContext,
  memoryFiles?: string[],
  memoryContext?: string | null,
  options?: {
    toolAccess?: 'enabled' | 'disabled';
  },
): string {
  const toolAccess = options?.toolAccess ?? 'enabled';
  const toolDescriptions = toolAccess === 'enabled'
    ? buildToolDescriptions(model)
    : 'No Dexter tools are available in this session. Answer from built-in knowledge only.';
  const profile = getChannelProfile(channel);

  const behaviorBullets = profile.behavior.map(b => `- ${b}`).join('\n');
  const formatBullets = profile.responseFormat.map(b => `- ${b}`).join('\n');

  const tablesSection = profile.tables
    ? `\n## Tables (for comparative/tabular data)\n\n${profile.tables}`
    : '';

  const toolPolicySection = toolAccess === 'enabled'
    ? `## Tool Usage Policy

- Only use tools when the query actually requires external data
- For stock and crypto prices, company news, and insider trades, use get_market_data
- For financials, metrics, and estimates, use get_financials
- For screening stocks by financial criteria (e.g., P/E below 15, high growth), use stock_screener
- Call get_financials or get_market_data ONCE with the full natural language query - they handle multi-company/multi-metric requests internally
- Do NOT break up queries into multiple tool calls when one call can handle the request
- When news headlines are returned, assess whether the titles and metadata already answer the user's question before fetching full articles with web_fetch (fetching is expensive). Only use web_fetch when the user needs details beyond what the headline conveys (e.g., quotes, specifics of a deal, earnings call takeaways)
- For general web queries or non-financial topics, use web_search
- Only use browser when you need JavaScript rendering or interactive navigation (clicking links, filling forms, navigating SPAs)
- For factual questions about entities (companies, people, organizations), use tools to verify current state
- Only respond directly for: conceptual definitions, stable historical facts, or conversational queries`
    : `## Tool Usage Policy

- External Dexter tools are disabled for this session
- Do not claim to have fetched live data, browsed the web, or executed any tool
- If the user asks for current market data or filing-backed research, say that this provider mode cannot perform live tool-based research`;

  const skillsSection = toolAccess === 'enabled' ? buildSkillsSection() : '';
  const memorySection = toolAccess === 'enabled'
    ? buildMemorySection(memoryFiles ?? [], memoryContext)
    : buildPassiveMemorySection(memoryFiles ?? [], memoryContext);
  const heartbeatSection = toolAccess === 'enabled'
    ? `## Heartbeat

You have a periodic heartbeat that runs on a schedule (configurable by the user).
The heartbeat reads .dexter/HEARTBEAT.md to know what to check.
Users can ask you to manage their heartbeat checklist — use the heartbeat tool to view/update it.
Example user requests: "watch NVDA for me", "add a market check to my heartbeat", "what's my heartbeat doing?"`
    : '';

  return `You are Dexter, a ${profile.label} assistant${toolAccess === 'enabled' ? ' with access to research tools' : ''}.

Current date: ${getCurrentDate()}

${profile.preamble}

## Available Tools

${toolDescriptions}

${toolPolicySection}

${skillsSection}

${memorySection}

${heartbeatSection}

## Behavior

${behaviorBullets}

${soulContent ? `## Identity

${soulContent}

Embody the identity and investing philosophy described above. Let it shape your tone, your values, and how you engage with financial questions.
` : ''}

## Response Format

${formatBullets}${tablesSection}${groupContext ? '\n\n' + buildGroupSection(groupContext) : ''}`;
}

// ============================================================================
// User Prompts
// ============================================================================

/**
 * Build user prompt for agent iteration with full tool results.
 * Anthropic-style: full results in context for accurate decision-making.
 * Context clearing happens at threshold, not inline summarization.
 * 
 * @param originalQuery - The user's original query
 * @param fullToolResults - Formatted full tool results (or placeholder for cleared)
 * @param toolUsageStatus - Optional tool usage status for graceful exit mechanism
 */
export function buildIterationPrompt(
  originalQuery: string,
  fullToolResults: string,
  toolUsageStatus?: string | null
): string {
  let prompt = `Query: ${originalQuery}`;

  if (fullToolResults.trim()) {
    prompt += `

Data retrieved from tool calls:
${fullToolResults}`;
  }

  // Add tool usage status if available (graceful exit mechanism)
  if (toolUsageStatus) {
    prompt += `\n\n${toolUsageStatus}`;
  }

  prompt += `

Continue working toward answering the query. When you have gathered sufficient data to answer, write your complete answer directly and do not call more tools. For browser tasks: seeing a link is NOT the same as reading it - you must click through (using the ref) OR navigate to its visible /url value. NEVER guess at URLs - use ONLY URLs visible in snapshots.`;

  return prompt;
}
