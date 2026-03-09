export { aihfDoubleCheckTool, AIHF_DOUBLE_CHECK_DESCRIPTION } from './aihf-double-check-tool.js';
export { callAIHF, getAihfApiUrl, AihfError } from './aihf-api.js';
export { getDefaultAihfGraph, getAnalystIds, getPMNodeId } from './aihf-graph.js';
export { comparePortfolioVsAihf, normalizeDecision, renderDoubleCheckMarkdown } from './aihf-double-check.js';
export { recordRun, loadHistory, computeStats, updateConflictOutcome } from './feedback.js';
export type * from './types.js';

/**
 * Returns true when AIHF_API_URL is configured.
 * Follows the same pattern as isHLAccountConfigured() and hasConfiguredClient().
 */
export function isAIHFConfigured(): boolean {
  return !!process.env.AIHF_API_URL?.trim();
}
