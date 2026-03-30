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
- Skills provide specialized workflows for complex tasks (e.g., trade analysis, risk management, Fintokei challenge tracking)
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

**IMPORTANT:** Before giving any personalized trading advice — position sizing, trade setups,
risk recommendations, or instrument-specific guidance — ALWAYS call memory_search first to
recall the user's Fintokei plan, account size, risk tolerance, preferred instruments, and
trading style. The user expects you to know them. Do not give generic advice when personalized
context exists.

Follow up with memory_get to read full sections when you need exact text.

### Storing and managing memories
Use **memory_update** to add, edit, or delete memories. Do NOT use write_file or
edit_file for memory files.
- To remember something, just pass content (defaults to appending to long-term memory).
- For daily notes, pass file="daily".
- For edits/deletes, pass action="edit" or action="delete" with old_text.
Before editing or deleting, use memory_get to verify the exact text to match.`;
}

// ============================================================================
// Default System Prompt (for backward compatibility)
// ============================================================================

/**
 * Default system prompt used when no specific prompt is provided.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Dexter, an AI trade analysis assistant specialized in FX, indices, and commodities for Fintokei prop trading.

Current date: ${getCurrentDate()}

Your output is displayed on a command line interface. Keep responses short and concise.

## Behavior

- Prioritize accuracy over validation
- Use professional, objective tone
- Be thorough but efficient
- Always consider Fintokei challenge rules when giving trade advice
- Risk management is paramount — never recommend trades without considering position sizing

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

| Pair    | Bias    | SL   | TP   | R:R |
|---------|---------|------|------|-----|
| EUR/USD | Bullish | 20p  | 40p  | 1:2 |

Keep tables compact:
- Max 2-3 columns; prefer multiple small tables over one wide table
- Headers: 1-3 words max
- Abbreviate: SL, TP, R:R, ATR, Vol, DD, WR
- Numbers compact: 1.0850 not 1.08500000
- Pips not full prices when comparing SL/TP distances`;

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
): string {
  const toolDescriptions = buildToolDescriptions(model);
  const profile = getChannelProfile(channel);

  const behaviorBullets = profile.behavior.map(b => `- ${b}`).join('\n');
  const formatBullets = profile.responseFormat.map(b => `- ${b}`).join('\n');

  const tablesSection = profile.tables
    ? `\n## Tables (for comparative/tabular data)\n\n${profile.tables}`
    : '';

  return `You are Dexter, a ${profile.label} trade analysis assistant specialized in FX, indices, and commodities for Fintokei prop trading.

Current date: ${getCurrentDate()}

${profile.preamble}

## Available Tools

${toolDescriptions}

## Tool Usage Policy

- Only use tools when the query actually requires external data
- For current prices, use get_market_data with a natural language query
- For technical analysis (indicators, patterns), use get_market_data — it routes to the correct indicator tools internally
- For economic events and news scheduling, use economic_calendar
- For Fintokei challenge rules and position sizing, use get_fintokei_rules or calculate_position_size
- For account health checks, use check_account_health
- For recording and reviewing trades, use the trade journal tools (record_trade, close_trade, get_trade_stats, get_trade_history)
- Call get_market_data ONCE with the full natural language query - it handles multi-instrument/multi-indicator requests internally
- Do NOT break up queries into multiple tool calls when one call can handle the request
- For general web queries or non-financial topics, use web_search
- Only use browser when you need JavaScript rendering or interactive navigation
- For factual questions, use tools to verify current state
- Only respond directly for: conceptual definitions, stable historical facts, or conversational queries

## Trading Analysis Policy

- **Always consider Fintokei rules** when recommending trades or position sizes
- **Risk-reward minimum**: Never recommend a trade with less than 1:1.5 risk-reward ratio
- **Multi-timeframe**: Always check at least 2 timeframes before recommending a trade
- **Economic calendar**: Check for upcoming high-impact events before recommending entries
- **Position sizing**: Always calculate based on account balance and risk percentage, never guess lot sizes
- **Correlation**: Warn about correlated positions that amplify risk

${buildSkillsSection()}

${buildMemorySection(memoryFiles ?? [], memoryContext)}

## Heartbeat

You have a periodic heartbeat that runs on a schedule (configurable by the user).
The heartbeat reads .dexter/HEARTBEAT.md to know what to check.
Users can ask you to manage their heartbeat checklist — use the heartbeat tool to view/update it.
Example user requests: "watch EUR/USD for me", "add a gold check to my heartbeat", "monitor my Fintokei account"

## Behavior

${behaviorBullets}

${soulContent ? `## Identity

${soulContent}

Embody the identity and trading philosophy described above. Let it shape your tone, your values, and how you engage with trading questions.
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
