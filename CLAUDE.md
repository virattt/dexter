# CLAUDE.md

## Project Overview

Dexter is an autonomous CLI-based financial research agent built with TypeScript. It decomposes complex financial questions into structured research plans, executes them using live market data, validates its own work, and produces data-backed answers.

- **Runtime**: Bun (use `bun` for all commands)
- **Language**: TypeScript (ESM, strict mode)
- **UI Framework**: pi-tui (`@mariozechner/pi-tui`) — terminal UI rendering
- **LLM Integration**: LangChain (multi-provider)
- **Version**: CalVer `YYYY.M.D` (no zero-padding)

## Build, Test, and Development Commands

```bash
bun install              # Install dependencies (runs `playwright install chromium` as postinstall)
bun run start            # Run Dexter (or: bun run src/index.tsx)
bun run dev              # Watch mode for development
bun run typecheck        # TypeScript type-checking (tsc --noEmit)
bun test                 # Run all tests (Bun's built-in test runner)
bun test --watch         # Watch mode for tests
bun run gateway          # Start WhatsApp gateway
bun run gateway:login    # Link WhatsApp account via QR code
bun run src/evals/run.ts # Run full evaluation suite
bun run src/evals/run.ts --sample 10  # Run eval on random sample
```

CI runs `bun run typecheck` and `bun test` on push to `main` and on PRs.

## Project Structure

```
src/
├── index.tsx              # Executable entry point (shebang, loads .env, calls runCli)
├── cli.ts                 # Main TUI controller (pi-tui based)
├── providers.ts           # LLM provider registry (single source of truth)
├── theme.ts               # Color/styling configuration (chalk-based)
├── types.ts               # Global type definitions
├── agent/                 # Core agent loop & orchestration
│   ├── agent.ts           # Main agent loop (async generator, yields events)
│   ├── tool-executor.ts   # Tool invocation, approval flow, deduplication
│   ├── prompts.ts         # System prompt builder (injects tools, skills, date)
│   ├── scratchpad.ts      # Execution history (JSONL in .dexter/scratchpad/)
│   ├── run-context.ts     # Per-query state container
│   ├── final-answer-context.ts  # Context builder for final answer generation
│   ├── token-counter.ts   # Token usage tracking from LLM responses
│   └── types.ts           # AgentEvent discriminated union types
├── components/            # pi-tui UI components
│   ├── ChatLogComponent   # Scrollable chat history with tool events
│   ├── CustomEditor       # Multi-line input editor
│   ├── SelectListComponent # Multi-select menu (providers, models)
│   ├── ApprovalPromptComponent # Approval flow for sensitive tools
│   ├── WorkingIndicatorComponent # Animated working state
│   └── ...
├── controllers/           # State management
│   ├── agent-runner.ts    # Agent execution lifecycle & event handling
│   ├── model-selection.ts # Provider/model selection & persistence
│   └── input-history.ts   # Query history (up/down arrow navigation)
├── model/
│   └── llm.ts             # Multi-provider LLM abstraction with retry logic
├── tools/                 # Tool system
│   ├── registry.ts        # Conditional tool loading based on env vars
│   ├── descriptions/      # Rich tool descriptions injected into system prompt
│   ├── finance/           # Financial data tools (prices, fundamentals, filings, etc.)
│   ├── search/            # Web search (Exa preferred, Perplexity, Tavily fallback)
│   ├── browser/           # Playwright-based web scraping
│   ├── fetch/             # Simple HTTP GET for web pages
│   ├── filesystem/        # read_file, write_file, edit_file (with sandbox & approval)
│   └── skill.ts           # Meta-tool for invoking SKILL.md workflows
├── skills/                # SKILL.md-based extensible workflows
│   ├── registry.ts        # Skill discovery (builtin + ~/.dexter/skills/ + .dexter/skills/)
│   └── dcf/SKILL.md       # DCF valuation skill
├── gateway/               # WhatsApp gateway integration
│   ├── gateway.ts         # Main gateway service
│   ├── channels/whatsapp/ # Baileys-based WhatsApp plugin
│   ├── sessions/          # Per-user session storage
│   ├── routing/           # Message routing
│   ├── access-control.ts  # Phone number allowlist
│   └── config.ts          # Gateway configuration (.dexter/gateway.json)
├── utils/                 # Shared utilities
│   ├── env.ts             # Environment variable loading & validation
│   ├── config.ts          # Persisted settings (.dexter/settings.json)
│   ├── cache.ts           # TTL-based data caching
│   ├── tokens.ts          # Token estimation (~3.5 chars/token), thresholds
│   ├── in-memory-chat-history.ts  # Multi-turn conversation context
│   ├── markdown-table.ts  # Table rendering
│   ├── progress-channel.ts # Async progress event queue
│   └── ai-message.ts      # AIMessage utility helpers
└── evals/                 # LangSmith evaluation framework
    ├── run.ts             # Eval runner with TUI progress display
    └── dataset/           # CSV question dataset
```

**Runtime config** (gitignored):
- `.dexter/settings.json` — persisted model/provider selection
- `.dexter/scratchpad/` — tool call JSONL logs for debugging
- `.dexter/sessions/` — WhatsApp gateway per-user sessions
- `.dexter/input-history.jsonl` — CLI query history

## Architecture

### Agent Loop (`src/agent/agent.ts`)

The agent uses an async generator pattern that yields typed events for real-time UI streaming:

1. Build system prompt with tool descriptions and skill metadata
2. Call LLM with prompt and bound tools
3. If tool calls returned, execute them via `AgentToolExecutor`
4. Manage context — clear oldest tool results when exceeding 100k token threshold (keeps 5 most recent)
5. Loop until max iterations (default 10) or no more tool calls
6. Generate final answer in a separate LLM call with full scratchpad context (no tools bound)

### Event System (`src/agent/types.ts`)

Agent events are a discriminated union: `ThinkingEvent | ToolStartEvent | ToolEndEvent | ToolErrorEvent | ToolProgressEvent | ToolLimitEvent | ToolApprovalEvent | ToolDeniedEvent | ContextClearedEvent | AnswerStartEvent | DoneEvent`

### Tool System (`src/tools/registry.ts`)

Tools are conditionally loaded based on available environment variables. Each tool uses `DynamicStructuredTool` from LangChain with Zod schemas for input validation. Tool descriptions in `src/tools/descriptions/` are injected into the system prompt.

**Approval flow**: `write_file` and `edit_file` require user approval. Approvals can be per-invocation (`allow-once`) or per-session (`allow-session`).

**Filesystem sandbox**: `src/tools/filesystem/sandbox.ts` validates paths to prevent directory traversal and symlink attacks.

### LLM Providers (`src/model/llm.ts`, `src/providers.ts`)

Provider routing is prefix-based on the model ID:
- `claude-*` → Anthropic (uses `cache_control: ephemeral` on system prompt for cost savings)
- `gemini-*` → Google
- `grok-*` → xAI
- `kimi-*` → Moonshot
- `deepseek-*` → DeepSeek
- `openrouter:*` → OpenRouter
- `ollama:*` → Ollama (local)
- No prefix → OpenAI (default, model: `gpt-5.2`)

LLM calls include retry logic (3 attempts with exponential backoff).

### Skills (`src/skills/`)

Skills are SKILL.md files with YAML frontmatter (`name`, `description`) and markdown instructions. Discovery scans three locations: `src/skills/` (builtin), `~/.dexter/skills/` (user), `.dexter/skills/` (project). Each skill runs at most once per query.

## Coding Conventions

### General Rules
- **TypeScript strict mode** — avoid `any` types
- **ESM throughout** — all imports use explicit `.js` extensions
- **Path aliases** — use `@/*` for imports from `src/` (configured in `tsconfig.json`)
- **No barrel exports** — import directly from specific modules, not index files
- **Keep files concise** — extract helpers rather than duplicating code
- **Minimal logging** — do not add logging unless explicitly asked
- **No documentation files** — do not create README or docs unless explicitly asked

### Naming
- **Files**: `kebab-case.ts` (e.g., `agent-runner.ts`, `token-counter.ts`)
- **Classes/Types/Interfaces**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `CONTEXT_THRESHOLD`, `KEEP_TOOL_USES`)

### Error Handling
- Try-catch with type guards: `error instanceof Error ? error.message : String(error)`
- Graceful fallbacks — return empty arrays or `undefined` on non-critical failures rather than throwing
- Zod schemas for runtime input validation on all tools

### Tool Implementation Pattern
```typescript
// 1. Define input schema with Zod
const schema = z.object({ param: z.string().describe('...') });

// 2. Create DynamicStructuredTool
export const myTool = new DynamicStructuredTool({
  name: 'tool_name',
  description: '...',
  schema,
  func: async (input) => {
    // Implementation
    return JSON.stringify({ data, sourceUrls });
  },
});

// 3. Register in src/tools/registry.ts with rich description
```

### Architecture Patterns
- **Async generators** for streaming events from agent to UI
- **Discriminated unions** for typed event handling
- **Single source of truth** — provider registry in `providers.ts`, config in `.dexter/settings.json`
- **Scratchpad persistence** — append-only JSONL for debugging and audit trail
- **Soft limits** — tool call limits emit warnings, not blocks (3 calls per tool)

## Environment Variables

### LLM API Keys
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- `XAI_API_KEY`, `OPENROUTER_API_KEY`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`

### Local LLM
- `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)

### Financial Data
- `FINANCIAL_DATASETS_API_KEY`

### Web Search (priority: Exa > Perplexity > Tavily)
- `EXASEARCH_API_KEY`, `PERPLEXITY_API_KEY`, `TAVILY_API_KEY`

### Tracing
- `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`

**Never commit `.env` files or real API keys.**

## Testing

- **Framework**: Bun's built-in test runner (Jest config exists for legacy compatibility)
- **Pattern**: Colocated `*.test.ts` files alongside source
- **Run**: `bun test` before pushing when you touch logic
- **CI**: Runs `bun run typecheck` and `bun test` on push/PR

## Version & Release

- **Format**: CalVer `YYYY.M.D` (no zero-padding), tag prefix `v`
- **Script**: `bash scripts/release.sh [version]` (defaults to today's date)
- **Flow**: bump `package.json` version → create git tag → push tag → create GitHub release via `gh`
- Do not push or publish without user confirmation

## Security

- API keys stored in `.env` (gitignored) or entered interactively via CLI
- Config stored in `.dexter/settings.json` (gitignored)
- Filesystem tools enforce sandbox path validation (`src/tools/filesystem/sandbox.ts`)
- Symlink traversal and directory escape attacks are detected and blocked
- Never commit or expose real API keys, tokens, or credentials
