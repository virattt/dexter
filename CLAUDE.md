# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun start              # Run the CLI application (interactive)
bun dev                # Watch mode for development
bun batch <file.txt>   # Batch mode - run research on multiple tickers
bun typecheck          # TypeScript type checking
bun test               # Run Jest test suite
bun test --watch       # Watch mode for tests
```

### Batch Mode
Run research on multiple tickers with JSON output:
```bash
bun batch tickers.txt                                    # One ticker per line
bun batch tickers.txt --output ./research                # Custom output dir
bun batch tickers.txt --template "Analyze {TICKER}..."   # Custom query template
```
Output: `outputs/<TICKER>.json` with query, answer, tasks, and metadata.

## Architecture Overview

Dexter is an autonomous financial research agent built with TypeScript/Bun that uses a **5-phase orchestration loop**:

```
UNDERSTAND (once) → PLAN → EXECUTE → REFLECT → (loop back to PLAN if needed) → ANSWER
```

### Phase Details
- **Understand**: Extract intent and entities from user query (runs once)
- **Plan**: Create task list with `taskType` ("use_tools" or "reason") and dependencies
- **Execute**: Run tasks in parallel respecting dependencies; tool selection happens at execution time using gpt-5-mini
- **Reflect**: Check if sufficient data collected; if not, loop back to Plan (max 5 iterations)
- **Answer**: Stream final response using accumulated context

### Key Directories

```
src/
├── agent/                    # Core orchestration
│   ├── orchestrator.ts       # Main Agent class - coordinates phases
│   ├── phases/               # Individual phase implementations
│   ├── schemas.ts            # Zod schemas for LLM structured output
│   ├── prompts.ts            # System prompts
│   └── tool-executor.ts      # Tool selection & execution
├── batch/                    # Batch mode (headless execution)
│   ├── headless-runner.ts    # Run agent without UI, collect results
│   └── types.ts              # BatchResult, TaskSummary types
├── model/llm.ts              # Multi-provider LLM abstraction (OpenAI, Claude, Gemini, Ollama)
├── tools/                    # Tool definitions
│   ├── finance/              # Financial data tools (fundamentals, prices, filings, etc.)
│   └── search/               # Web search (Tavily)
├── components/               # React/Ink terminal UI components
├── hooks/useAgentExecution.ts # React hook connecting agent to UI
└── utils/
    ├── context.ts            # Tool context manager (caching to .dexter/context/)
    └── message-history.ts    # Conversation history management
```

### Core Patterns

1. **Structured Output with Zod**: All LLM interactions use Zod schemas (`UnderstandingSchema`, `PlanSchema`, `ReflectionSchema`, etc.)

2. **Multi-Provider LLM** (`getChatModel()` in `src/model/llm.ts`): Supports OpenAI (default), Anthropic (prefix: "claude-"), Google (prefix: "gemini-"), Ollama (prefix: "ollama:")

3. **Deferred Tool Selection**: Tools are selected at execution time (not planning time) by a fast model (gpt-5-mini)

4. **Callback-Based UI Updates**: Agent uses `AgentCallbacks` interface for real-time UI integration without tight coupling

5. **Context Management**: `ToolContextManager` persists tool outputs to `.dexter/context/` using content-addressed storage (MD5 hash)

### Adding New Financial Tools
1. Create tool in `src/tools/finance/`
2. Export from `src/tools/index.ts`

### Environment Variables
Required: `FINANCIAL_DATASETS_API_KEY`
LLM keys (at least one): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
Optional: `TAVILY_API_KEY` (web search), `OLLAMA_BASE_URL` (local models)
