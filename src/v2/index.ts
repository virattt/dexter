// V2 Agent - Simple agentic loop with Skills pattern

export { Agent } from './agent.js';
export type { AgentResult } from './agent.js';

export { loadSkills, getToolsFromSkills, buildSkillsPromptSection, executeTool } from './skill-loader.js';

export { ContextManager } from './context.js';

export { getCurrentDate, buildSystemPrompt, buildIterationPrompt, SYSTEM_PROMPT_TEMPLATE } from './prompts.js';

export type { 
  Skill, 
  ToolCallResult, 
  AgentConfig, 
  Message,
  AgentEvent,
  ThinkingEvent,
  ToolStartEvent,
  ToolEndEvent,
  ToolErrorEvent,
  AnswerStartEvent,
  AnswerChunkEvent,
  DoneEvent,
} from './types.js';
