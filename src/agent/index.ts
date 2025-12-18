// Main Agent class and types
export { Agent, AgentCallbacks, AgentOptions, ToolCallInfo, ToolCallResult } from './agent.js';

// Schemas and types
export {
  ThinkingStep,
  ToolCallStep,
  Iteration,
  AgentState,
  ToolSummary,
  FinishToolSchema,
  FinishToolArgs,
  ThinkingSchema,
  Thinking,
  SelectedContextsSchema,
  SelectedContexts,
} from './schemas.js';

// Prompts (shared utilities)
export {
  DEFAULT_SYSTEM_PROMPT,
  getCurrentDate,
  getAnswerSystemPrompt,
  getSystemPrompt,
  formatToolSummaries,
  buildUserPrompt,
  CONTEXT_SELECTION_SYSTEM_PROMPT,
} from './prompts.js';
