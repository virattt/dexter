import { CombinedAutocompleteProvider, Container, ProcessTerminal, Spacer, Text, TUI, type SlashCommand } from '@mariozechner/pi-tui';
import type {
  ApprovalDecision,
  ReasoningEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from './agent/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';
import { logger } from './utils/logger.js';
import { isThinkingModel } from './model/llm.js';
import {
  AgentRunnerController,
  InputHistoryController,
  ModelSelectionController,
} from './controllers/index.js';
import {
  ApiKeyInputComponent,
  ApprovalPromptComponent,
  ChatLogComponent,
  CustomEditor,
  DebugPanelComponent,
  IntroComponent,
  WorkingIndicatorComponent,
  createApiKeyConfirmSelector,
  createModelSelector,
  createProviderSelector,
} from './components/index.js';
import { editorTheme, theme } from './theme.js';
import type { HistoryItem } from './types.js';
import { formatDuration, formatExchangeForScrollback } from './utils/scrollback.js';

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) {
    return `${str.slice(0, lastSpace)}...`;
  }
  return `${str.slice(0, maxLength)}...`;
}

function summarizeToolResult(tool: string, args: Record<string, unknown>, result: string): string {
  if (tool === 'skill') {
    const skillName = args.skill as string;
    return `Loaded ${skillName} skill`;
  }
  try {
    const parsed = JSON.parse(result);
    if (parsed.data) {
      if (Array.isArray(parsed.data)) {
        return `Received ${parsed.data.length} items`;
      }
      if (typeof parsed.data === 'object') {
        const keys = Object.keys(parsed.data).filter((key) => !key.startsWith('_'));
        if (tool === 'get_financials' || tool === 'get_market_data' || tool === 'stock_screener') {
          return keys.length === 1 ? 'Called 1 data source' : `Called ${keys.length} data sources`;
        }
        if (tool === 'web_search') {
          return 'Did 1 search';
        }
        return `Received ${keys.length} fields`;
      }
    }
  } catch {
    return truncateAtWord(result, 50);
  }
  return 'Received data';
}

function createScreen(
  title: string,
  description: string,
  body: any,
  footer?: string,
): Container {
  const container = new Container();
  if (title) {
    container.addChild(new Text(theme.bold(theme.primary(title)), 0, 0));
  }
  if (description) {
    container.addChild(new Text(theme.muted(description), 0, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(body);
  if (footer) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.muted(footer), 0, 0));
  }
  return container;
}

// ─── Slash command registry ───────────────────────────────────────────────────
// Keep this in sync with the handleSubmit switch below so /help always reflects
// the real set of available commands.

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help',  description: 'Show available commands and keyboard shortcuts' },
  { name: 'model', description: 'Switch the LLM model or provider' },
  { name: 'think', description: 'Toggle Ollama extended thinking on/off (thinking models only)' },
];

function buildHelpPanel(): Container {
  const container = new Container();
  const COL = 10; // fixed width for the left (command/key) column

  const row = (label: string, desc: string) =>
    new Text(`  ${theme.primary(label.padEnd(COL))} ${theme.muted(desc)}`, 0, 0);

  container.addChild(new Text(theme.bold('Slash Commands'), 0, 0));
  container.addChild(new Spacer(1));
  for (const cmd of SLASH_COMMANDS) {
    container.addChild(row(`/${cmd.name}`, cmd.description ?? ''));
  }

  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.bold('Keyboard Shortcuts'), 0, 0));
  container.addChild(new Spacer(1));

  const shortcuts: [string, string][] = [
    ['↑ / ↓',   'Browse input history'],
    ['Tab',      'Accept autocomplete suggestion'],
    ['Esc',      'Cancel current operation'],
    ['Ctrl+C',   'Exit Dexter'],
  ];
  for (const [key, desc] of shortcuts) {
    container.addChild(row(key, desc));
  }

  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.bold('Tips'), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(row('/', 'Type / to see available commands'));
  container.addChild(row('Thinking', 'Enabled automatically for qwen3, deepseek-r1, qwq models'));
  container.addChild(row('Fallback', 'Dexter uses web search when financial APIs fail'));

  return container;
}

/**
 * Render only the most recent history item (currently executing or just completed).
 * Completed exchanges are flushed to the terminal scrollback buffer so the TUI
 * stays lean — only the active query lives in the TUI viewport.
 */
function renderCurrentQuery(chatLog: ChatLogComponent, history: AgentRunnerController['history']) {
  chatLog.clearAll();
  const item = history[history.length - 1];
  if (!item) return;

  chatLog.addQuery(item.query);
  chatLog.resetToolGrouping();

  if (item.status === 'interrupted') {
    chatLog.addInterrupted();
  }

  for (const display of item.events) {
    const event = display.event;
    if (event.type === 'thinking') {
      const message = event.message.trim();
      if (message) {
        const preview = message.length > 120 ? `${message.slice(0, 120)}…` : message;
        chatLog.addChild(new Text(theme.muted(`  💭 ${preview}`), 0, 0));
      }
      continue;
    }

    if (event.type === 'reasoning') {
      const reasoning = (event as ReasoningEvent).content.trim();
      if (reasoning) {
        const preview = reasoning.length > 300 ? `${reasoning.slice(0, 300)}...` : reasoning;
        chatLog.addChild(new Spacer(1));
        chatLog.addChild(new Text(theme.muted(`💭 Reasoning (${reasoning.length} chars)`), 0, 0));
        chatLog.addChild(new Text(theme.muted(preview), 0, 0));
      }
      continue;
    }

    if (event.type === 'tool_start') {
      const toolStart = event as ToolStartEvent;
      const component = chatLog.startTool(display.id, toolStart.tool, toolStart.args);
      if (display.completed && display.endEvent?.type === 'tool_end') {
        const done = display.endEvent as ToolEndEvent;
        component.setComplete(
          summarizeToolResult(done.tool, toolStart.args, done.result),
          done.duration,
        );
      } else if (display.completed && display.endEvent?.type === 'tool_error') {
        const toolError = display.endEvent as ToolErrorEvent;
        component.setError(toolError.error);
      } else if (display.progressMessage) {
        component.setActive(display.progressMessage);
      }
      continue;
    }

    if (event.type === 'tool_approval') {
      const approval = chatLog.startTool(display.id, event.tool, event.args);
      approval.setApproval(event.approved);
      continue;
    }

    if (event.type === 'tool_denied') {
      const denied = chatLog.startTool(display.id, event.tool, event.args);
      const path = (event.args.path as string) ?? '';
      denied.setDenied(path, event.tool);
      continue;
    }

    if (event.type === 'tool_limit') {
      continue;
    }

    if (event.type === 'context_cleared') {
      chatLog.addContextCleared(event.clearedCount, event.keptCount);
    }
  }

  if (item.answer) {
    chatLog.finalizeAnswer(item.answer);
  }
  if (item.status === 'complete') {
    chatLog.addPerformanceStats(item.duration ?? 0, item.tokenUsage, item.tokensPerSecond);
  }
}


/**
 * Flush a completed exchange to the terminal's native scrollback buffer.
 *
 * How it works:
 *  1. Capture how many lines the TUI is currently rendering (before stop).
 *  2. Stop the TUI — this positions the hardware cursor at the end of all
 *     rendered content and briefly disables raw mode.
 *  3. Move the cursor back to the top of the TUI area and clear downward so
 *     the "live processing" view doesn't litter the scrollback.
 *  4. Write the formatted exchange — it lands in the terminal's scroll buffer.
 *  5. Clear the TUI component tree (chatLog) so the next render starts fresh.
 *  6. Restart the TUI — re-enables raw mode, resets rendering state, re-renders
 *     the now-empty chatLog + editor from the current cursor position.
 */
export function flushExchangeToScrollback(
  tui: TUI,
  chatLog: ChatLogComponent,
  item: HistoryItem,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tuiInternal = tui as any;
  // Snapshot BEFORE stop() moves the cursor.
  const prevLineCount: number = tuiInternal.previousLines?.length ?? 0;

  // Stop TUI: moves cursor to end of rendered content (+\r\n), disables raw mode.
  tui.stop();

  // Move cursor back to the top of the TUI's rendered area and clear to end of
  // screen so the live processing trail doesn't appear above the clean output.
  if (prevLineCount > 0) {
    // After stop(), cursor is prevLineCount lines below TUI start (+1 for the \r\n).
    process.stdout.write(`\x1b[${prevLineCount + 1}A`); // move up
    process.stdout.write('\x1b[J');                     // clear to end of screen
  }

  // Write the formatted exchange — this is what lands in the scroll buffer.
  process.stdout.write(formatExchangeForScrollback(item));

  // Clear TUI component state.
  chatLog.clearAll();

  // Restart TUI: re-enable raw mode, hide cursor.
  // requestRender(true) resets all cursor-tracking state so the first render
  // starts cleanly from the current cursor position (below our written content).
  tui.start();
  tui.requestRender(true);
}

export async function runCli() {
  const tui = new TUI(new ProcessTerminal());
  const root = new Container();
  const chatLog = new ChatLogComponent(tui);
  const inputHistory = new InputHistoryController(() => tui.requestRender());
  let lastError: string | null = null;
  let helpVisible = false;
  // null = auto-detect from model name; true/false = explicit override
  let thinkEnabled: boolean | null = null;

  const onError = (message: string) => {
    lastError = message;
    logger.error(message);
    tui.requestRender();
  };

  const modelSelection = new ModelSelectionController(onError, () => {
    // Reset thinking override when the user switches models — the new model may
    // or may not support thinking, so auto-detect is the correct default.
    thinkEnabled = null;
    agentRunner.setThinkEnabled(undefined);
    intro.setModel(modelSelection.model);
    renderSelectionOverlay();
    tui.requestRender();
  });

  const agentRunner = new AgentRunnerController(
    { model: modelSelection.model, modelProvider: modelSelection.provider, maxIterations: 15 },
    modelSelection.inMemoryChatHistory,
    () => {
      renderCurrentQuery(chatLog, agentRunner.history);
      workingIndicator.setState(agentRunner.workingState);
      renderSelectionOverlay();
      tui.requestRender();
    },
  );

  const intro = new IntroComponent(modelSelection.model);
  const errorText = new Text('', 0, 0);
  const workingIndicator = new WorkingIndicatorComponent(tui);
  const editor = new CustomEditor(tui, editorTheme);
  const debugPanel = new DebugPanelComponent(8, true);

  // Register slash command autocomplete so typing / shows a completion dropdown.
  editor.setAutocompleteProvider(new CombinedAutocompleteProvider(SLASH_COMMANDS));

  tui.addChild(root);

  const refreshError = () => {
    const message = lastError ?? agentRunner.error;
    errorText.setText(message ? theme.error(`Error: ${message}`) : '');
  };

  const handleSubmit = async (query: string) => {
    // Dismiss help overlay before processing; re-show below only if /help typed again.
    if (helpVisible) {
      helpVisible = false;
      renderSelectionOverlay();
    }

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      tui.stop();
      process.exit(0);
      return;
    }

    if (query === '/help') {
      helpVisible = true;
      renderSelectionOverlay();
      return;
    }

    if (query === '/think') {
      const model = modelSelection.model;
      if (!isThinkingModel(model)) {
        lastError = `${model} does not support extended thinking (supported: qwen3, deepseek-r1, qwq)`;
        refreshError();
        tui.requestRender();
      } else {
        // Cycle: auto(on) → off → auto(on)
        // null  = auto (effective: on for thinking models)
        // false = forced off
        const wasOff = thinkEnabled === false;
        thinkEnabled = wasOff ? null : false;
        agentRunner.setThinkEnabled(thinkEnabled ?? undefined);
        const label = thinkEnabled === false ? '🔕 Thinking OFF' : '🧠 Thinking ON (auto)';
        lastError = null;
        // Show brief status via the intro line (reuses existing text component path)
        intro.setModel(`${model}  ${label}`);
        renderSelectionOverlay();
        tui.requestRender();
        // Restore normal model label after 3 s
        setTimeout(() => {
          intro.setModel(model);
          tui.requestRender();
        }, 3000);
      }
      return;
    }

    if (query === '/model') {
      modelSelection.startSelection();
      return;
    }

    if (modelSelection.isInSelectionFlow() || agentRunner.pendingApproval || agentRunner.isProcessing) {
      return;
    }

    // Flush the PREVIOUS completed exchange to scrollback now, before we clear
    // the chatLog for the new query.  This keeps the last answer visible in the
    // TUI until the user submits a new question.
    const prevItem = agentRunner.history.at(-1);
    if (prevItem && (prevItem.status === 'complete' || prevItem.status === 'interrupted')) {
      flushExchangeToScrollback(tui, chatLog, prevItem);
    }

    await inputHistory.saveMessage(query);
    inputHistory.resetNavigation();
    const result = await agentRunner.runQuery(query);
    if (result?.answer) {
      await inputHistory.updateAgentResponse(result.answer);
    }

    // The completed exchange stays in the chatLog (visible in TUI) until the
    // user's next query triggers the flush above.  Just refresh the error line
    // and re-render so the idle hint footer and cursor are correct.
    refreshError();
    tui.requestRender();
  };

  editor.onSubmit = (text) => {
    const value = text.trim();
    if (!value) return;
    editor.setText('');
    editor.addToHistory(value);
    void handleSubmit(value);
  };

  editor.onEscape = () => {
    if (helpVisible) {
      helpVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (modelSelection.isInSelectionFlow()) {
      modelSelection.cancelSelection();
      return;
    }
    if (agentRunner.isProcessing || agentRunner.pendingApproval) {
      agentRunner.cancelExecution();
      return;
    }
  };

  editor.onCtrlC = () => {
    if (modelSelection.isInSelectionFlow()) {
      modelSelection.cancelSelection();
      return;
    }
    if (agentRunner.isProcessing || agentRunner.pendingApproval) {
      agentRunner.cancelExecution();
      return;
    }
    tui.stop();
    process.exit(0);
  };

  const renderMainView = () => {
    root.clear();
    // Collapse the 15-line ASCII intro to a single header line once the user
    // has started a conversation, freeing vertical space for the chat log.
    intro.setCompact(agentRunner.history.length > 0);
    // Sync think state into the status bar (auto = on for thinking-capable models).
    intro.setThinkState(thinkEnabled !== false && isThinkingModel(modelSelection.model));
    root.addChild(intro);
    root.addChild(chatLog);
    if (lastError ?? agentRunner.error) {
      root.addChild(errorText);
    }
    if (agentRunner.workingState.status !== 'idle') {
      root.addChild(workingIndicator);
    }
    // Hint footer: keyboard shortcuts when idle, cancel hint while running.
    const hintLine = agentRunner.isProcessing
      ? theme.muted('  esc · cancel query')
      : theme.muted('  ↑↓ history  ·  /model  /think  /help  ·  ctrl+c exit');
    root.addChild(new Text(hintLine, 0, 0));
    root.addChild(editor);
    root.addChild(debugPanel);
    tui.setFocus(editor);
  };

  const renderScreenView = (
    title: string,
    description: string,
    body: any,
    footer?: string,
    focusTarget?: any,
  ) => {
    root.clear();
    root.addChild(createScreen(title, description, body, footer));
    if (focusTarget) {
      tui.setFocus(focusTarget);
    }
  };

  const renderSelectionOverlay = () => {
    const state = modelSelection.state;

    if (helpVisible) {
      renderScreenView(
        '⬡ Dexter — Help',
        '',
        buildHelpPanel(),
        'Esc to close · type a question to close and ask',
        editor,
      );
      return;
    }

    if (state.appState === 'idle' && !agentRunner.pendingApproval) {
      refreshError();
      renderMainView();
      return;
    }

    if (agentRunner.pendingApproval) {
      const prompt = new ApprovalPromptComponent(
        agentRunner.pendingApproval.tool,
        agentRunner.pendingApproval.args,
      );
      prompt.onSelect = (decision: ApprovalDecision) => {
        agentRunner.respondToApproval(decision);
      };
      renderScreenView('', '', prompt, undefined, prompt.selector);
      return;
    }

    if (state.appState === 'provider_select') {
      const selector = createProviderSelector(modelSelection.provider, (providerId) => {
        void modelSelection.handleProviderSelect(providerId);
      });
      renderScreenView(
        'Select provider',
        'Switch between LLM providers. Applies to this session and future sessions.',
        selector,
        'Enter to confirm · esc to exit',
        selector,
      );
      return;
    }

    if (state.appState === 'model_select' && state.pendingProvider) {
      const selector = createModelSelector(
        state.pendingModels,
        modelSelection.provider === state.pendingProvider ? modelSelection.model : undefined,
        (modelId) => modelSelection.handleModelSelect(modelId),
        state.pendingProvider,
      );
      renderScreenView(
        `Select model for ${getProviderDisplayName(state.pendingProvider)}`,
        '',
        selector,
        'Enter to confirm · esc to go back',
        selector,
      );
      return;
    }

    if (state.appState === 'model_input' && state.pendingProvider) {
      const input = new ApiKeyInputComponent();
      input.onSubmit = (value) => modelSelection.handleModelInputSubmit(value);
      input.onCancel = () => modelSelection.handleModelInputSubmit(null);
      renderScreenView(
        `Enter model name for ${getProviderDisplayName(state.pendingProvider)}`,
        'Type or paste the model name from openrouter.ai/models',
        input,
        'Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b\nEnter to confirm · esc to go back',
        input,
      );
      return;
    }

    if (state.appState === 'api_key_confirm' && state.pendingProvider) {
      const selector = createApiKeyConfirmSelector((wantsToSet) =>
        modelSelection.handleApiKeyConfirm(wantsToSet),
      );
      renderScreenView(
        'Set API Key',
        `Would you like to set your ${getProviderDisplayName(state.pendingProvider)} API key?`,
        selector,
        'Enter to confirm · esc to decline',
        selector,
      );
      return;
    }

    if (state.appState === 'api_key_input' && state.pendingProvider) {
      const input = new ApiKeyInputComponent(true);
      input.onSubmit = (apiKey) => modelSelection.handleApiKeySubmit(apiKey);
      input.onCancel = () => modelSelection.handleApiKeySubmit(null);
      const apiKeyName = getApiKeyNameForProvider(state.pendingProvider) ?? '';
      renderScreenView(
        `Enter ${getProviderDisplayName(state.pendingProvider)} API Key`,
        apiKeyName ? `(${apiKeyName})` : '',
        input,
        'Enter to confirm · Esc to cancel',
        input,
      );
    }
  };

  await inputHistory.init();
  for (const msg of inputHistory.getMessages().reverse()) {
    editor.addToHistory(msg);
  }
  renderSelectionOverlay();
  refreshError();

  tui.start();
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    process.once('exit', finish);
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });

  workingIndicator.dispose();
  debugPanel.dispose();
}
