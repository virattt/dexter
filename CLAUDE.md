# CLAUDE.md - Developer Guide for AI Assistants

This document provides comprehensive context about the Yassir codebase for AI assistants working on this project.

## Project Overview

**Yassir** is an autonomous financial research agent that performs deep analysis using task planning, self-reflection, and real-time market data. Think "Claude Code for financial research."

### Core Purpose
- Take complex financial questions and decompose them into structured research plans
- Execute tasks autonomously using real-time financial data and tools
- Validate results through self-reflection and iterative refinement
- Synthesize findings into comprehensive, data-backed answers

### Key Features
- Multi-phase agent architecture (Understand → Plan → Execute → Reflect → Answer)
- Just-in-time tool selection with parallel task execution
- Iterative reflection loop for data sufficiency validation
- Context management with intelligent tool result caching
- Multi-provider LLM support (OpenAI, Anthropic, Google)
- Terminal UI built with React + Ink

## Architecture

### Five-Phase Agent System

The agent follows a sophisticated pipeline with an iterative core loop:

```
┌──────────────┐
│ 1. UNDERSTAND│ (Once)
│ Extract intent & entities
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│         ITERATIVE REFLECTION LOOP                │
│  (Repeats up to MAX_ITERATIONS until complete)   │
│                                                   │
│  ┌──────────┐    ┌─────────┐    ┌──────────┐   │
│  │ 2. PLAN  │ -> │ 3. EXEC │ -> │ 4. REFLECT│   │
│  │          │    │         │    │          │   │
│  │ Create   │    │ Run     │    │ Evaluate │   │
│  │ task list│    │ tasks   │    │ progress │   │
│  └──────────┘    └─────────┘    └─────┬────┘   │
│                                         │        │
│                                    Complete?     │
│                                         │        │
└─────────────────────────────────────────┼────────┘
                                          │ Yes
                                          ▼
                                   ┌──────────┐
                                   │ 5. ANSWER│
                                   │ Synthesize final response
                                   └──────────┘
```

#### Phase Descriptions

1. **Understand Phase** (`src/agent/phases/understand.ts`)
   - Runs ONCE at the start
   - Extracts user intent and key entities (tickers, dates, metrics, periods)
   - Normalizes company names to ticker symbols
   - Handles conversation history context
   - Output: `Understanding` object with intent and entities

2. **Plan Phase** (`src/agent/phases/plan.ts`)
   - Creates a minimal, focused task list (2-5 tasks)
   - Each task has:
     - `taskType`: 'use_tools' (data fetching) or 'reason' (analysis)
     - `dependsOn`: Array of task IDs that must complete first
   - Builds on prior plans in subsequent iterations
   - Uses reflection guidance to fill data gaps
   - Output: `Plan` object with summary and tasks

3. **Execute Phase** (`src/agent/phases/execute.ts`)
   - For 'use_tools' tasks: Uses just-in-time tool selection (gpt-5-mini)
   - For 'reason' tasks: Runs LLM-based analysis on gathered data
   - Executes tasks in parallel when possible (respects dependencies)
   - Saves all tool results to `.yassir/context/` for future use
   - Output: Updates `TaskResult` map

4. **Reflect Phase** (`src/agent/phases/reflect.ts`)
   - Evaluates data sufficiency: "Can we answer the query with current data?"
   - Decides: `isComplete: true/false`
   - If incomplete: Identifies `missingInfo` and `suggestedNextSteps`
   - Considers iteration limit (pragmatic about what's achievable)
   - Output: `ReflectionResult` object

5. **Answer Phase** (`src/agent/phases/answer.ts`)
   - Synthesizes all task results into final answer
   - Streams response to user in real-time
   - Includes sources section with API URLs for referenced data
   - Uses plain text format (no markdown in output)
   - Output: Streamed text response

### Key Design Patterns

#### Context Management
- **Location**: `src/utils/context.ts`
- Tool results are cached in `.yassir/context/` with deterministic filenames
- Each file named: `{TICKER}_{TOOL_NAME}_{ARGS_HASH}.json`
- Context includes: tool name, args, description, result, sourceUrls, timestamp
- Intelligent context selection using LLM to pick relevant cached data
- Prevents redundant API calls and enables cross-query learning

#### Task Execution
- **Location**: `src/agent/task-executor.ts`
- Builds dependency graph from task list
- Executes tasks in parallel when dependencies allow
- Tracks execution state via callbacks for UI updates
- Handles both 'use_tools' and 'reason' task types differently

#### Tool Execution
- **Location**: `src/agent/tool-executor.ts`
- Manages tool calls and result persistence
- Integrates with ToolContextManager for caching
- Tracks executed tools to prevent duplicates
- Returns lightweight ToolSummary objects (not full results)

## Directory Structure

```
yassir/
├── src/
│   ├── agent/                    # Core agent implementation
│   │   ├── orchestrator.ts       # Main agent coordinator (entry point)
│   │   ├── state.ts              # TypeScript types/interfaces for agent state
│   │   ├── schemas.ts            # Zod schemas for structured outputs
│   │   ├── prompts.ts            # All system & user prompts for each phase
│   │   ├── tool-executor.ts     # Executes tools and manages results
│   │   ├── task-executor.ts     # Executes tasks with dependency management
│   │   └── phases/              # Individual phase implementations
│   │       ├── understand.ts    # Phase 1: Intent & entity extraction
│   │       ├── plan.ts          # Phase 2: Task list generation
│   │       ├── execute.ts       # Phase 3: Reason task execution
│   │       ├── reflect.ts       # Phase 4: Reflection & evaluation
│   │       └── answer.ts        # Phase 5: Final answer synthesis
│   │
│   ├── tools/                   # Tool implementations
│   │   ├── index.ts            # Tool registry (TOOLS array)
│   │   ├── types.ts            # Tool-related types
│   │   ├── finance/            # Financial data tools
│   │   │   ├── fundamentals.ts # Income statements, balance sheets, cash flow
│   │   │   ├── prices.ts       # Stock price data
│   │   │   ├── metrics.ts      # Financial metrics (P/E, etc.)
│   │   │   ├── filings.ts      # SEC filings (10-K, 10-Q, 8-K)
│   │   │   ├── news.ts         # Company news
│   │   │   ├── estimates.ts    # Analyst estimates
│   │   │   ├── segments.ts     # Revenue by segment
│   │   │   ├── insider_trades.ts # Insider trading data
│   │   │   ├── crypto.ts       # Cryptocurrency prices
│   │   │   ├── api.ts          # Halal Terminal API client
│   │   │   └── constants.ts    # API endpoints and constants
│   │   └── search/             # Search tools
│   │       ├── tavily.ts       # Web search via Tavily
│   │       └── index.ts        # Search tool exports
│   │
│   ├── model/                   # LLM integration layer
│   │   └── llm.ts              # Multi-provider LLM client (OpenAI, Anthropic, Google)
│   │
│   ├── components/              # React Ink UI components
│   │   ├── AgentProgressView.tsx    # Shows agent phase progress
│   │   ├── TaskListView.tsx         # Displays task list with status
│   │   ├── QueueDisplay.tsx         # Shows queued queries
│   │   ├── AnswerBox.tsx            # Renders final answers
│   │   ├── ModelSelector.tsx        # UI for switching LLM models
│   │   ├── StatusMessage.tsx        # Status indicator component
│   │   ├── Input.tsx                # Query input component
│   │   ├── Intro.tsx                # Welcome screen
│   │   ├── ApiKeyPrompt.tsx         # API key setup flow
│   │   └── index.ts                 # Component exports
│   │
│   ├── hooks/                   # React hooks
│   │   ├── useAgentExecution.ts # Manages agent lifecycle
│   │   ├── useApiKey.ts         # API key validation & storage
│   │   └── useQueryQueue.ts     # Query queue management
│   │
│   ├── utils/                   # Utility modules
│   │   ├── context.ts          # ToolContextManager (caching & selection)
│   │   ├── message-history.ts  # Conversation history management
│   │   ├── config.ts           # Configuration management
│   │   ├── env.ts              # Environment variable helpers
│   │   └── index.ts            # Utility exports
│   │
│   ├── cli/                    # CLI-specific code
│   │   └── types.ts            # CLI type definitions
│   │
│   ├── cli.tsx                 # Main CLI application (React Ink app)
│   ├── index.tsx               # Application entry point
│   └── theme.ts                # UI theme configuration
│
├── .yassir/                    # Runtime data (gitignored)
│   └── context/                # Cached tool results
│       └── *.json             # Individual tool result files
│
├── package.json                # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── jest.config.js             # Jest test configuration
├── env.example                # Environment variable template
├── README.md                  # User-facing documentation
└── CLAUDE.md                  # This file - AI assistant guide
```

## Tech Stack

### Runtime & Core
- **Bun**: JavaScript runtime and package manager (v1.0+)
- **TypeScript**: Type-safe JavaScript (ESNext target)
- **Node.js**: Compatible runtime (ES Modules)

### LLM & AI
- **LangChain.js**: LLM orchestration framework
  - `@langchain/core`: Core abstractions
  - `@langchain/openai`: OpenAI integration (GPT-4.1, GPT-5.2)
  - `@langchain/anthropic`: Anthropic integration (Claude Sonnet 4.5)
  - `@langchain/google-genai`: Google integration (Gemini 3)
  - `@langchain/tavily`: Web search integration
- **Zod**: Runtime schema validation and type generation

### UI & Presentation
- **React**: Component-based UI (v19)
- **Ink**: Terminal UI framework for React
- **ink-spinner**: Loading indicators
- **ink-text-input**: Text input component

### APIs & Data Sources
- **Halal Terminal API**: Primary financial data provider (market data, Shariah screening, Islamic finance)
- **Tavily API**: Web search for news and research (optional)

### Development
- **Jest**: Testing framework
- **ts-jest**: TypeScript Jest transformer
- **Babel**: JavaScript transpilation for tests

## Code Conventions

### TypeScript Patterns

#### Type Organization
- **State types**: `src/agent/state.ts` - All agent-related interfaces and types
- **Schema types**: Infer from Zod schemas in `src/agent/schemas.ts`
- **Local types**: Define in same file when only used locally
- **Export discipline**: Only export types needed by other modules

#### Naming Conventions
```typescript
// Interfaces: PascalCase with descriptive names
interface AgentCallbacks { ... }
interface PlanInput { ... }

// Types: PascalCase for unions and aliases
type Phase = 'understand' | 'plan' | 'execute' | 'reflect' | 'answer';
type TaskType = 'use_tools' | 'reason';

// Functions: camelCase, verb-based names
async function executeTasks(...) { ... }
function buildReflectUserPrompt(...) { ... }

// Constants: UPPER_SNAKE_CASE
const DEFAULT_MAX_ITERATIONS = 5;
const TOOLS: StructuredToolInterface[] = [...];
```

#### Async/Await
- Always use `async/await` over promises and callbacks
- Handle errors at appropriate boundaries
- Use retry logic for external API calls (see `withRetry` in `llm.ts`)

#### Module System
- Use ES Modules (`import`/`export`)
- File extensions required: `.js` for imports (even for `.ts` files, due to Bun)
- Barrel exports via `index.ts` files for cleaner imports

### Prompt Engineering

#### Prompt Organization
All prompts are in `src/agent/prompts.ts`:
- System prompts: `{PHASE}_SYSTEM_PROMPT` constants
- User prompt builders: `build{Phase}UserPrompt()` functions
- Date injection: Use `getCurrentDate()` for {current_date} placeholder

#### Prompt Best Practices
1. **Be specific about date context**: Always inject current date
2. **Use structured outputs**: Define Zod schemas for JSON responses
3. **Provide examples**: Include good/bad examples in prompts
4. **Keep constraints clear**: Max task count, word limits, format requirements
5. **Separate concerns**: Different prompts for different phases/purposes

### Tool Development

#### Creating a New Tool
1. **Define tool in appropriate category** (`src/tools/finance/` or `src/tools/search/`)
2. **Use LangChain's tool decorator pattern**:
```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const myNewTool = tool(
  async ({ param1, param2 }) => {
    // Tool implementation
    const result = await fetchData(param1, param2);
    return formatToolResult(result, sourceUrls);
  },
  {
    name: 'my_new_tool',
    description: 'Clear, concise description of what this tool does',
    schema: z.object({
      param1: z.string().describe('Description of param1'),
      param2: z.number().describe('Description of param2'),
    }),
  }
);
```
3. **Return formatted results** using `formatToolResult(data, sourceUrls)` from `tools/types.ts`
4. **Register tool** in `src/tools/index.ts` TOOLS array
5. **Export tool** from appropriate index file

#### Tool Guidelines
- **Descriptive names**: Use `get_*` prefix for data retrieval tools
- **Clear schemas**: Every parameter should have a description
- **Source URLs**: Always include sourceUrls when data comes from external APIs
- **Error handling**: Return meaningful error messages as strings
- **Deterministic**: Same inputs should produce same outputs (for caching)

### Component Development

#### React Ink Patterns
```typescript
import React from 'react';
import { Box, Text } from 'ink';

interface MyComponentProps {
  data: string;
  isActive: boolean;
}

export const MyComponent: React.FC<MyComponentProps> = ({ data, isActive }) => {
  return (
    <Box flexDirection="column">
      <Text color={isActive ? 'green' : 'gray'}>
        {data}
      </Text>
    </Box>
  );
};
```

#### UI Best Practices
- Use `Box` for layout, `Text` for content
- Apply colors from `src/theme.ts`
- Keep components focused and composable
- Handle loading states explicitly
- Use hooks for state management (`hooks/`)

## Development Workflows

### Environment Setup

1. **Install Bun** (if not already installed):
```bash
curl -fsSL https://bun.com/install | bash
```

2. **Clone and install dependencies**:
```bash
git clone <repo-url>
cd yassir
bun install
```

3. **Configure environment variables**:
```bash
cp env.example .env
# Edit .env and add your API keys
```

Required API keys:
- `OPENAI_API_KEY`: OpenAI API (or other provider keys)
- `HALAL_TERMINAL_API_KEY`: Halal Terminal API key (market data + Shariah screening)
- `TAVILY_API_KEY`: Web search (optional)

### Running the Application

```bash
# Development mode (with auto-reload)
bun dev

# Production mode
bun start

# Type checking
bun typecheck

# Tests
bun test
bun test --watch
```

### Git Workflow

This project follows standard Git practices:
1. Create feature branch from main: `git checkout -b feature/my-feature`
2. Make focused commits with clear messages
3. Push branch: `git push -u origin feature/my-feature`
4. Create pull request for review

### Adding New Features

#### Adding a New Phase
1. Create phase file in `src/agent/phases/my-phase.ts`
2. Define phase options interface and class
3. Add system prompt to `src/agent/prompts.ts`
4. Add phase to `Phase` type union in `src/agent/state.ts`
5. Integrate into orchestrator flow in `src/agent/orchestrator.ts`

#### Adding a New Tool
See "Tool Development" section above.

#### Modifying Agent Behavior
- **Change task planning**: Edit `src/agent/phases/plan.ts` and `PLAN_SYSTEM_PROMPT`
- **Adjust reflection logic**: Edit `src/agent/phases/reflect.ts` and `REFLECT_SYSTEM_PROMPT`
- **Change answer format**: Edit `src/agent/phases/answer.ts` and `FINAL_ANSWER_SYSTEM_PROMPT`
- **Update entity extraction**: Edit `src/agent/phases/understand.ts`

### Testing Strategy

#### Current Test Setup
- Framework: Jest with ts-jest
- Config: `jest.config.js`
- Run: `bun test`

#### Test Organization
```
src/
├── __tests__/           # Test files
│   ├── agent/          # Agent tests
│   ├── tools/          # Tool tests
│   └── utils/          # Utility tests
```

#### Writing Tests
```typescript
import { describe, it, expect } from '@jest/globals';

describe('MyFeature', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

## Key Files Reference

### Critical Files (Must Understand)
- `src/agent/orchestrator.ts`: Agent main loop and phase coordination
- `src/agent/state.ts`: All TypeScript type definitions
- `src/agent/prompts.ts`: All LLM prompts
- `src/model/llm.ts`: LLM client with multi-provider support
- `src/tools/index.ts`: Tool registry
- `src/utils/context.ts`: Context caching and selection

### Entry Points
- `src/index.tsx`: Application entry (minimal)
- `src/cli.tsx`: Main CLI app component (React Ink)
- `package.json`: Scripts and dependencies

### Configuration Files
- `tsconfig.json`: TypeScript compiler settings
- `.env`: Environment variables (not in repo)
- `env.example`: Environment template

## Common Tasks for AI Assistants

### When Asked to Add a Financial Data Source
1. Check if the Halal Terminal API already provides it (see `src/tools/finance/halal-market.ts` and `src/tools/finance/shariah.ts`)
2. If yes: Add tool in `src/tools/finance/` following existing patterns
3. If no: Discuss adding the endpoint to the Halal Terminal backend
4. Always include sourceUrls in tool results

### When Asked to Improve Prompts
1. Locate prompt in `src/agent/prompts.ts`
2. Understand current behavior by reading phase implementation
3. Test changes with representative queries
4. Ensure structured output schemas still match

### When Asked to Debug Agent Behavior
1. Check callback logs from `AgentCallbacks` in `orchestrator.ts`
2. Review phase inputs/outputs in execution flow
3. Verify tool results in `.yassir/context/` files
4. Check prompt construction in `prompts.ts`

### When Asked to Add UI Features
1. Create component in `src/components/`
2. Use existing components as templates
3. Integrate via `src/cli.tsx` or relevant parent component
4. Test in terminal (not browser)

## Anti-Patterns to Avoid

### DON'T
- ❌ Create circular dependencies between modules
- ❌ Put business logic in React components (keep in `agent/` or `utils/`)
- ❌ Hard-code API keys or secrets
- ❌ Bypass ToolContextManager for tool result storage
- ❌ Use console.log for debugging (use proper logging or callbacks)
- ❌ Ignore TypeScript errors (fix them, don't suppress)
- ❌ Create overly complex task lists (keep 2-5 tasks)
- ❌ Skip source URLs in tool results
- ❌ Use markdown in answer output (plain text only)

### DO
- ✅ Follow existing file organization patterns
- ✅ Use TypeScript types everywhere
- ✅ Leverage context caching for efficiency
- ✅ Write clear, descriptive commit messages
- ✅ Add tests for new features
- ✅ Use structured outputs (Zod schemas) for LLM calls
- ✅ Keep phases focused and single-purpose
- ✅ Document complex logic with comments
- ✅ Follow the established prompt engineering patterns

## Useful Commands

```bash
# Development
bun dev                    # Run with auto-reload
bun start                  # Run production mode
bun typecheck              # Check TypeScript types

# Testing
bun test                   # Run all tests
bun test --watch          # Watch mode
bun test <file>           # Run specific test

# Debugging
bun --inspect start       # Run with debugger

# Cleanup
rm -rf .yassir/context/*  # Clear cached tool results
rm -rf node_modules/      # Clean dependencies
bun install               # Reinstall dependencies
```

## Model Selection

The agent supports multiple LLM providers:

### Default Models
- **Planning & Reasoning**: GPT-5.2 (OpenAI) - Configurable
- **Tool Selection**: GPT-5.2-mini (OpenAI) - Fast, efficient for tool calls

### Switching Models
Users can switch models at runtime using `/model` command in CLI:
- GPT 4.1 or GPT 5.2 (OpenAI)
- Claude Sonnet 4.5 (Anthropic)
- Gemini 3 (Google)

### Model Configuration
See `src/model/llm.ts`:
- `getChatModel(modelName, streaming)`: Creates model instance
- Model detection via prefix matching ('claude-', 'gemini-', default: OpenAI)
- Automatic API key retrieval from environment

## Context & State Management

### Tool Context Flow
```
Tool Execution → ToolExecutor → ToolContextManager → .yassir/context/{file}.json
                                        ↓
                                  ToolSummary → Agent State
                                        ↓
                              Future queries can reuse via selectRelevantContexts()
```

### State Objects
- `AgentState`: Complete agent execution state
- `Understanding`: Intent + entities from Understand phase
- `Plan`: Task list with dependencies
- `TaskResult`: Output from completed tasks
- `ReflectionResult`: Reflection evaluation
- `ToolSummary`: Lightweight tool call summary (not full result)

### Message History
- `MessageHistory` class (`src/utils/message-history.ts`)
- Tracks conversation turns with summaries
- Enables context-aware follow-up queries
- LLM-based selection of relevant prior messages

## API Integration

### Halal Terminal API
- Base URL: `https://api.halalterminal.com`
- Authentication: `X-API-Key` header (`HALAL_TERMINAL_API_KEY` env var)
- Market data tools: `src/tools/finance/halal-market.ts`
- Shariah / Islamic finance tools: `src/tools/finance/shariah.ts`

### Tavily Search API
- Optional web search capability
- Only included if `TAVILY_API_KEY` is set
- Tool: `src/tools/search/tavily.ts`

## Performance Considerations

### Optimization Strategies
1. **Parallel Execution**: Tasks without dependencies run in parallel
2. **Context Caching**: Avoid redundant API calls via `.yassir/context/`
3. **Lightweight Summaries**: Store full results on disk, pass summaries in memory
4. **Streaming Answers**: Stream final answer to improve perceived latency
5. **Fast Model for Tools**: Use GPT-5.2-mini for tool selection

### Iteration Limits
- Default: 5 iterations (Plan → Execute → Reflect loop)
- Prevents infinite loops
- Reflection phase becomes more pragmatic near limit

## Troubleshooting Guide

### Common Issues

#### "API Key not found"
- Check `.env` file exists and has correct key names
- Verify key format (no quotes, no extra spaces)
- Ensure `.env` is in project root

#### "Module not found" errors
- Run `bun install` to ensure dependencies are installed
- Check import paths use `.js` extension
- Verify file exists at import path

#### Agent loops indefinitely
- Check reflection logic in `src/agent/phases/reflect.ts`
- Verify iteration limit is being enforced
- Review reflection prompt for clarity

#### Tool results not cached
- Check `.yassir/context/` directory exists and is writable
- Verify `ToolContextManager` is being used correctly
- Check tool args are consistent (affects hash)

#### Type errors
- Run `bun typecheck` to see all errors
- Check imports from `src/agent/state.ts`
- Ensure Zod schema types match usage

## Security & Best Practices

### API Key Management
- Never commit `.env` file
- Use environment variables for all secrets
- Rotate keys periodically
- Use minimum required permissions

### Input Validation
- All tool inputs validated via Zod schemas
- LLM outputs validated with structured output schemas
- User inputs sanitized before processing

### Rate Limiting
- Retry logic with exponential backoff (see `llm.ts`)
- Context caching reduces API calls
- Be mindful of API rate limits

## Future Enhancements

Potential areas for development:
- Additional financial data sources (earnings call transcripts, institutional holdings)
- More sophisticated reflection strategies (learning from past queries)
- Visualization support (charts, tables)
- Export capabilities (PDF reports, CSV data)
- Multi-user support (separate context directories)
- Custom tool authoring via configuration
- Web interface (in addition to CLI)

## Resources

### Documentation
- [Bun Docs](https://bun.sh/docs)
- [LangChain.js Docs](https://js.langchain.com/)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Zod Documentation](https://zod.dev/)

### APIs
- [Halal Terminal API](https://api.halalterminal.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic API](https://docs.anthropic.com/)
- [Tavily API](https://docs.tavily.com/)

## Version History

- **v2.4.1** (Current): Multi-provider LLM support, reflection phase, answer streaming
- See `package.json` for current version
- See git history for detailed changelog

---

**Last Updated**: 2026-01-12

This document should be updated whenever significant architectural changes are made to the codebase.
