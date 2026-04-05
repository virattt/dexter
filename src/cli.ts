import { Container, ProcessTerminal, Spacer, Text, TUI } from '@mariozechner/pi-tui';
import type {
  ApprovalDecision,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from './agent/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';
import { defaultQueue } from './utils/message-queue.js';
import { logger } from './utils/logger.js';
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
  HintBarComponent,
  IntroComponent,
  WorkingIndicatorComponent,
  createApiKeyConfirmSelector,
  createModelSelector,
  createProviderSelector,
} from './components/index.js';
import { editorTheme, theme } from './theme.js';
import { matchCommands, type SlashCommand } from './commands/index.js';
import { initSpinner } from './utils/spinner.js';

function truncateForHistory(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= 3) return text;
  const firstLine = lines[0].trim() || lines[1]?.trim() || 'pasted content';
  const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
  return `${preview} [+${lines.length - 1} lines]`;
}

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

/**
 * Render a single display event into the chat log (used by incremental history).
 */
function renderEvent(
  chatLog: ChatLogComponent,
  display: { event: any; id: string; completed?: boolean; endEvent?: any; progressMessage?: string },
  itemStatus: string,
) {
  const event = display.event;

  if (event.type === 'thinking') {
    const message = event.message.trim();
    if (message) {
      chatLog.addChild(
        new Text(message.length > 200 ? `${message.slice(0, 200)}...` : message, 0, 0),
      );
    }
    return;
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
    } else if (itemStatus === 'interrupted') {
      // Don't start spinner for tools in interrupted items
    } else if (display.progressMessage) {
      component.setActive(display.progressMessage);
    }
    return;
  }

  if (event.type === 'tool_approval') {
    chatLog.startTool(display.id, event.tool, event.args).setApproval(event.approved);
    return;
  }

  if (event.type === 'tool_denied') {
    const path = (event.args.path as string) ?? '';
    chatLog.startTool(display.id, event.tool, event.args).setDenied(path, event.tool);
    return;
  }

  if (event.type === 'tool_limit') return;

  if (event.type === 'context_cleared') {
    chatLog.addContextCleared(event.clearedCount, event.keptCount);
  }
  if (event.type === 'microcompact') {
    chatLog.addMicrocompact(event.cleared, event.tokensSaved);
  }
  if (event.type === 'queue_drain') {
    chatLog.addQueueDrain(event.messageCount);
  }
  if (event.type === 'compaction' && event.phase === 'end') {
    chatLog.addCompaction(event.success ?? false, event.preCompactTokens, event.postCompactTokens);
  }
}

export async function runCli() {
  const tui = new TUI(new ProcessTerminal());
  const root = new Container();
  const chatLog = new ChatLogComponent(tui);
  const inputHistory = new InputHistoryController(() => tui.requestRender());
  let lastError: string | null = null;

  const onError = (message: string) => {
    lastError = message;
    logger.error(message);
    tui.requestRender();
  };

  let agentRunner: AgentRunnerController;
  const modelSelection = new ModelSelectionController(onError, () => {
    intro.setModel(modelSelection.model);
    agentRunner?.updateAgentConfig({
      model: modelSelection.model,
      modelProvider: modelSelection.provider,
    });
    renderSelectionOverlay();
    tui.requestRender();
  });

  // Incremental history tracking
  let lastRenderedEventCount = 0;
  let lastRenderedStatus = '';
  let lastRenderedAnswer = false;
  const finalizedToolIds = new Set<string>();

  agentRunner = new AgentRunnerController(
    { model: modelSelection.model, modelProvider: modelSelection.provider, maxIterations: 10 },
    modelSelection.inMemoryChatHistory,
    () => {
      // Incremental history update — only render new events
      const history = agentRunner.history;
      const lastItem = history[history.length - 1];
      if (lastItem) {
        // New query started
        if (lastItem.events.length === 0 && lastRenderedEventCount === 0 && !lastRenderedAnswer) {
          chatLog.addQuery(lastItem.query);
          chatLog.resetToolGrouping();
        }

        // Render new events only
        for (let i = lastRenderedEventCount; i < lastItem.events.length; i++) {
          renderEvent(chatLog, lastItem.events[i], lastItem.status);
        }
        lastRenderedEventCount = lastItem.events.length;

        // Update already-rendered tool events that may have completed
        for (const display of lastItem.events) {
          if (display.event.type === 'tool_start' && display.completed && display.endEvent && !finalizedToolIds.has(display.id)) {
            const component = chatLog.getToolById(display.id);
            if (component) {
              finalizedToolIds.add(display.id);
              if (display.endEvent.type === 'tool_end') {
                component.setComplete(
                  summarizeToolResult(display.endEvent.tool, display.event.args, display.endEvent.result),
                  display.endEvent.duration,
                );
              } else if (display.endEvent.type === 'tool_error') {
                component.setError(display.endEvent.error);
              }
            }
          }
        }

        // Handle completion
        if (lastItem.answer && !lastRenderedAnswer) {
          chatLog.finalizeAnswer(lastItem.answer);
          lastRenderedAnswer = true;
        }
        if (lastItem.status === 'complete' && lastRenderedStatus !== 'complete') {
          chatLog.addPerformanceStats(lastItem.duration ?? 0, lastItem.tokenUsage, lastItem.tokensPerSecond);
        }
        if (lastItem.status === 'interrupted' && lastRenderedStatus !== 'interrupted') {
          // Stop all active tool spinners on interrupt
          for (const display of lastItem.events) {
            if (display.event.type === 'tool_start' && !finalizedToolIds.has(display.id)) {
              const component = chatLog.getToolById(display.id);
              component?.dispose?.();
              finalizedToolIds.add(display.id);
            }
          }
          chatLog.addInterrupted();
        }
        lastRenderedStatus = lastItem.status;
      }

      workingIndicator.setState(agentRunner.workingState);
      updateView();
      throttledRender();
    },
  );

  const intro = new IntroComponent(modelSelection.model);
  const errorText = new Text('', 0, 0);
  const workingIndicator = new WorkingIndicatorComponent(tui);
  const editor = new CustomEditor(tui, editorTheme);
  const hintBar = new HintBarComponent();
  const debugPanel = new DebugPanelComponent(8, true);
  const spacer = new Spacer(1);

  // Build the component tree ONCE — stable structure, no root.clear()
  root.addChild(intro);
  root.addChild(chatLog);
  root.addChild(errorText);
  root.addChild(workingIndicator);
  root.addChild(spacer);
  root.addChild(editor);
  root.addChild(hintBar);
  root.addChild(debugPanel);
  tui.addChild(root);
  initSpinner(tui);

  // Render throttle for agent events (~30fps max)
  let renderPending = false;
  const RENDER_THROTTLE_MS = 32;
  function throttledRender(): void {
    if (renderPending) return;
    renderPending = true;
    setTimeout(() => {
      renderPending = false;
      tui.requestRender();
    }, RENDER_THROTTLE_MS);
  }

  const refreshError = () => {
    const message = lastError ?? agentRunner.error;
    errorText.setText(message ? theme.error(`Error: ${message}`) : '');
  };

  // Slash command autocomplete state
  let slashSuggestions: SlashCommand[] = [];
  let slashSelectedIndex = 0;
  let slashActive = false;

  const HELP_TEXT = `Keyboard Shortcuts
  esc          Interrupt query / clear input
  ctrl+c       Exit Dexter
  /model       Switch LLM provider and model
  /rules       Show research rules
  /clear       Clear conversation
  ↑ / ↓        Navigate input history`;

  const handleSlashCommand = async (command: string) => {
    switch (command) {
      case 'model':
        modelSelection.startSelection();
        break;
      case 'rules':
        await agentRunner.runQuery('Show me my current research rules from .dexter/RULES.md');
        break;
      case 'clear':
        chatLog.clearAll();
        tui.requestRender();
        break;
      case 'memory':
        await agentRunner.runQuery('Show me what you know about me from memory. Use memory_search and memory_get.');
        break;
      case 'heartbeat':
        await agentRunner.runQuery('Show me my current heartbeat checklist from .dexter/HEARTBEAT.md');
        break;
      case 'history': {
        const messages = modelSelection.inMemoryChatHistory.getMessages();
        chatLog.addChild(new Spacer(1));
        if (messages.length === 0) {
          chatLog.addChild(new Text(theme.muted('No conversation history yet.'), 0, 0));
        } else {
          chatLog.addChild(new Text(theme.muted('Recent conversations:'), 0, 0));
          for (const msg of messages) {
            const summary = msg.summary ?? msg.answer?.slice(0, 100) ?? '(pending)';
            chatLog.addChild(new Text(theme.muted(`  ${msg.id + 1}. ${msg.query}`), 0, 0));
            chatLog.addChild(new Text(theme.muted(`     ${summary}`), 0, 0));
          }
        }
        tui.requestRender();
        break;
      }
      case 'help':
        chatLog.addChild(new Spacer(1));
        chatLog.addChild(new Text(theme.muted(HELP_TEXT), 0, 0));
        tui.requestRender();
        break;
    }
  };

  // Slash callbacks are wired after renderSelectionOverlay is defined (below)

  const handleSubmit = async (query: string) => {
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      tui.stop();
      process.exit(0);
      return;
    }

    // Handle all slash commands
    if (query.startsWith('/')) {
      const command = query.slice(1).trim().toLowerCase();
      slashActive = false;
      slashSuggestions = [];
      await handleSlashCommand(command);
      return;
    }

    if (modelSelection.isInSelectionFlow() || agentRunner.pendingApproval) {
      return;
    }

    // If agent is busy, enqueue the message for mid-run injection
    if (agentRunner.isProcessing) {
      defaultQueue.enqueue({
        text: query,
        priority: 'next',
        enqueuedAt: Date.now(),
        source: 'cli',
      });
      await inputHistory.saveMessage(query);
      chatLog.addQueuedMessage(query);
      tui.requestRender();
      return;
    }

    await inputHistory.saveMessage(query);
    inputHistory.resetNavigation();
    lastRenderedEventCount = 0;
    lastRenderedStatus = '';
    lastRenderedAnswer = false;
    finalizedToolIds.clear();
    const result = await agentRunner.runQuery(query);
    if (result?.answer) {
      await inputHistory.updateAgentResponse(result.answer);
    }
    refreshError();
    tui.requestRender();
  };

  editor.onSubmit = (text) => {
    const displayValue = text.trim();
    if (!displayValue) return;
    const fullValue = editor.getFullText(displayValue);
    editor.setText('');
    editor.addToHistoryWithTruncation(fullValue);
    void handleSubmit(fullValue);
  };

  let escPendingClear = false;
  let escPendingExit = false;
  let escTimeout: ReturnType<typeof setTimeout> | null = null;

  // onEscape is wired after renderSelectionOverlay is defined (below)

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

  /**
   * Update component state without rebuilding the tree.
   * The root is built once at init — this only changes text/hints/visibility.
   */
  const updateView = () => {
    refreshError();
    if (slashActive && slashSuggestions.length > 0) {
      hintBar.setSuggestions(slashSuggestions, slashSelectedIndex);
    } else {
      hintBar.clearSuggestions();
      hintBar.update({
        isProcessing: agentRunner.isProcessing,
        hasPendingApproval: !!agentRunner.pendingApproval,
        hasInput: editor.getText().trim().length > 0,
        escPendingClear,
        escPendingExit,
        queueLength: defaultQueue.length(),
      });
    }
    if (!modelSelection.isInSelectionFlow() && !agentRunner.pendingApproval) {
      tui.setFocus(editor);
    }
  };

  /**
   * Show an overlay screen using pi-tui's native overlay system.
   * Does NOT touch the root tree — overlays render on top.
   */
  const showScreenOverlay = (
    title: string,
    description: string,
    body: any,
    footer?: string,
    focusTarget?: any,
  ) => {
    if (tui.hasOverlay()) tui.hideOverlay();
    const screen = createScreen(title, description, body, footer);
    tui.showOverlay(screen);
    if (focusTarget) {
      tui.setFocus(focusTarget);
    }
  };

  const renderSelectionOverlay = () => {
    const state = modelSelection.state;
    if (state.appState === 'idle' && !agentRunner.pendingApproval) {
      if (tui.hasOverlay()) {
        tui.hideOverlay();
        tui.setFocus(editor);
      }
      updateView();
      tui.requestRender();
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
      showScreenOverlay('', '', prompt, undefined, prompt.selector);
      return;
    }

    if (state.appState === 'provider_select') {
      const selector = createProviderSelector(modelSelection.provider, (providerId) => {
        void modelSelection.handleProviderSelect(providerId);
      });
      showScreenOverlay(
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
      showScreenOverlay(
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
      showScreenOverlay(
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
      showScreenOverlay(
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
      showScreenOverlay(
        `Enter ${getProviderDisplayName(state.pendingProvider)} API Key`,
        apiKeyName ? `(${apiKeyName})` : '',
        input,
        'Enter to confirm · Esc to cancel',
        input,
      );
    }
  };

  // Wire callbacks that need renderSelectionOverlay (defined above)
  editor.onEscape = () => {
    if (modelSelection.isInSelectionFlow()) {
      modelSelection.cancelSelection();
      return;
    }
    if (agentRunner.isProcessing || agentRunner.pendingApproval) {
      agentRunner.cancelExecution();
      return;
    }

    const hasText = editor.getText().trim().length > 0;
    if (hasText) {
      // Double-Esc to clear input
      if (escPendingClear) {
        editor.setText('');
        escPendingClear = false;
        escPendingExit = false;
        if (escTimeout) { clearTimeout(escTimeout); escTimeout = null; }
      } else {
        escPendingClear = true;
        escPendingExit = false;
        if (escTimeout) clearTimeout(escTimeout);
        escTimeout = setTimeout(() => {
          escPendingClear = false;
          updateView();
          tui.requestRender();
        }, 2000);
      }
    } else {
      // Double-Esc to exit
      if (escPendingExit) {
        tui.stop();
        process.exit(0);
      } else {
        escPendingExit = true;
        escPendingClear = false;
        if (escTimeout) clearTimeout(escTimeout);
        escTimeout = setTimeout(() => {
          escPendingExit = false;
          updateView();
          tui.requestRender();
        }, 2000);
      }
    }
    updateView();
    tui.requestRender();
  };

  editor.onSlashChange = (text: string) => {
    slashSuggestions = matchCommands(text);
    slashSelectedIndex = 0;
    slashActive = slashSuggestions.length > 0;
    updateView();
    tui.requestRender();
  };

  editor.onSlashNavigate = (direction: 'up' | 'down') => {
    if (direction === 'down') {
      slashSelectedIndex = Math.min(slashSelectedIndex + 1, slashSuggestions.length - 1);
    } else {
      slashSelectedIndex = Math.max(slashSelectedIndex - 1, 0);
    }
    updateView();
    tui.requestRender();
  };

  editor.onSlashSelect = () => {
    const selected = slashSuggestions[slashSelectedIndex];
    if (selected) {
      slashActive = false;
      slashSuggestions = [];
      editor.setText('');
      void handleSlashCommand(selected.name);
    }
    updateView();
    tui.requestRender();
  };

  editor.onSlashDismiss = () => {
    slashActive = false;
    slashSuggestions = [];
    updateView();
    tui.requestRender();
  };

  await inputHistory.init();
  for (const msg of inputHistory.getMessages().reverse()) {
    editor.addToHistoryWithTruncation(msg);
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
