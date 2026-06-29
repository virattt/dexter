/**
 * Subagent type registry.
 *
 * A "subagent" is a fresh, isolated agent loop that the main (leader) agent can
 * delegate a focused sub-task to. Each type below is a small config bundle: a
 * worker system prompt, a tool allow-list, and an iteration budget. The leader
 * picks a type via the `spawn_subagent` tool; the subagent runs to completion
 * and returns a single answer.
 */

/** Configuration for one subagent type. */
export interface SubagentTypeConfig {
  /** Help text shown to the leader so it knows when to pick this type. */
  whenToUse: string;
  /** Self-contained worker system prompt for the subagent. */
  systemPrompt: string;
  /** Allow-list of tool names (must match registry names) the subagent may use. */
  tools: string[];
  /** Maximum agent loop iterations for the subagent. */
  maxIterations: number;
}

/**
 * Tools a subagent may never receive. The delegate tool is listed here so a
 * subagent can never spawn its own subagents — delegation is one level deep.
 */
export const SUBAGENT_DISALLOWED_TOOLS = new Set<string>(['spawn_subagent', 'ask_user_question', 'bash']);

/**
 * Read-only tools available to a general-purpose subagent. Deliberately excludes
 * write/edit/memory-mutation tools: subagents run in parallel and must not race
 * on approval prompts or side effects.
 */
const READ_ONLY_TOOLS = [
  'get_financials',
  'get_market_data',
  'read_filings',
  'stock_screener',
  'web_search',
  'x_search',
  'web_fetch',
  'read_file',
  'memory_search',
  'memory_get',
];

const WORKER_PREAMBLE =
  'You are a subagent working on a single sub-task assigned by an orchestrator. ' +
  'You run in isolation: you cannot see the main conversation and you cannot ' +
  'delegate to other subagents. Complete only the assigned task. Your final ' +
  'message is returned verbatim to the orchestrator, so make it a complete, ' +
  'self-contained answer — state your findings and conclusions directly, not a ' +
  'description of what you did.';

export const SUBAGENT_TYPES: Record<string, SubagentTypeConfig> = {
  'general-purpose': {
    whenToUse: 'Multi-step research or analysis on one focused sub-task.',
    systemPrompt: `${WORKER_PREAMBLE}\n\nYou are a general-purpose research worker. Use the available tools to gather and analyze whatever the task requires, then report your findings.`,
    tools: READ_ONLY_TOOLS,
    maxIterations: 8,
  },
  research: {
    whenToUse: 'Gather and synthesize external information on a single topic.',
    systemPrompt: `${WORKER_PREAMBLE}\n\nYou are a research worker. Gather information from the web, news, and filings, cross-check sources, and synthesize a clear, sourced summary of what you found.`,
    tools: ['web_search', 'x_search', 'web_fetch', 'read_filings', 'get_market_data'],
    maxIterations: 8,
  },
  analysis: {
    whenToUse: 'Quantitative financial analysis on specific companies.',
    systemPrompt: `${WORKER_PREAMBLE}\n\nYou are a financial analysis worker. Pull the relevant financials, metrics, and market data, then deliver a focused quantitative analysis with the numbers that support it.`,
    tools: ['get_financials', 'get_market_data', 'stock_screener', 'read_filings'],
    maxIterations: 8,
  },
};

export const DEFAULT_SUBAGENT_TYPE = 'general-purpose';

/** The subagent types the leader may choose from. */
export const SUBAGENT_TYPE_NAMES = Object.keys(SUBAGENT_TYPES) as [string, ...string[]];

/** Resolve a type's tool allow-list with disallowed tools stripped defensively. */
export function resolveSubagentTools(typeKey: string): string[] {
  const cfg = SUBAGENT_TYPES[typeKey] ?? SUBAGENT_TYPES[DEFAULT_SUBAGENT_TYPE];
  return cfg.tools.filter(t => !SUBAGENT_DISALLOWED_TOOLS.has(t));
}
