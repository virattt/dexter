// ============================================================================
// Agent - Planning with just-in-time tool selection
// ============================================================================

// Main orchestrator
export { Agent } from './orchestrator.js';
export type { AgentOptions, AgentCallbacks } from './orchestrator.js';

// State types
export type {
  Phase,
  TaskStatus,
  TaskType,
  EntityType,
  Entity,
  UnderstandInput,
  Understanding,
  ToolCall,
  ToolCallStatus,
  PlanInput,
  Task,
  Plan,
  ExecuteInput,
  TaskResult,
  ToolSummary,
  AgentState,
} from './state.js';

export { createInitialState } from './state.js';

// Schemas
export {
  EntitySchema,
  UnderstandingSchema,
  PlanTaskSchema,
  PlanSchema,
  SelectedContextsSchema,
} from './schemas.js';

export type {
  UnderstandingOutput,
  PlanOutput,
  SelectedContextsOutput,
} from './schemas.js';

// Phases
export {
  UnderstandPhase,
  PlanPhase,
  ExecutePhase,
} from './phases/index.js';

export type {
  UnderstandPhaseOptions,
  PlanPhaseOptions,
  ExecutePhaseOptions,
} from './phases/index.js';

// Prompts
export {
  getCurrentDate,
  getUnderstandSystemPrompt,
  getPlanSystemPrompt,
  getToolSelectionSystemPrompt,
  getExecuteSystemPrompt,
  getFinalAnswerSystemPrompt,
  buildUnderstandUserPrompt,
  buildPlanUserPrompt,
  buildToolSelectionPrompt,
  buildExecuteUserPrompt,
  buildFinalAnswerUserPrompt,
} from './prompts.js';
