import { Container, ProcessTerminal, Spacer, Text, TUI } from '@mariozechner/pi-tui';
import type {
  ApprovalDecision,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from './agent/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';
import { logger } from './utils/logger.js';
import {
  AgentRunnerController,
  ApiKeyManagerController,
  HalalKeyController,
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
  createKeyManagerSelector,
  createModelSelector,
  createProviderSelector,
} from './components/index.js';
import { editorTheme, theme } from './theme.js';

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

function renderHistory(chatLog: ChatLogComponent, history: AgentRunnerController['history']) {
  chatLog.clearAll();
  for (const item of history) {
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
          chatLog.addChild(
            new Text(message.length > 200 ? `${message.slice(0, 200)}...` : message, 0, 0),
          );
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

  const halalKey = new HalalKeyController(() => {
    renderSelectionOverlay();
    tui.requestRender();
  });

  const modelSelection = new ModelSelectionController(onError, () => {
    intro.setModel(modelSelection.model);
    // When LLM key setup completes (state returns to idle), start Halal wizard if needed
    if (!modelSelection.isInSelectionFlow() && !halalKey.isActive()) {
      halalKey.startIfNeeded();
    }
    renderSelectionOverlay();
    tui.requestRender();
  });

  const apiKeyManager = new ApiKeyManagerController(() => {
    renderSelectionOverlay();
    tui.requestRender();
  });

  const agentRunner = new AgentRunnerController(
    { model: modelSelection.model, modelProvider: modelSelection.provider, maxIterations: 10 },
    modelSelection.inMemoryChatHistory,
    () => {
      renderHistory(chatLog, agentRunner.history);
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

  tui.addChild(root);

  const refreshError = () => {
    const message = lastError ?? agentRunner.error;
    errorText.setText(message ? theme.error(`Error: ${message}`) : '');
  };

  const handleSubmit = async (query: string) => {
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      tui.stop();
      process.exit(0);
      return;
    }

    if (query === '/model') {
      modelSelection.startSelection();
      return;
    }

    if (query === '/keys') {
      apiKeyManager.open();
      return;
    }

    if (halalKey.isActive() || apiKeyManager.isActive() || modelSelection.isInSelectionFlow() || agentRunner.pendingApproval || agentRunner.isProcessing) {
      return;
    }

    await inputHistory.saveMessage(query);
    inputHistory.resetNavigation();
    const result = await agentRunner.runQuery(query);
    if (result?.answer) {
      await inputHistory.updateAgentResponse(result.answer);
    }
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
    if (halalKey.isActive()) {
      halalKey.dismiss();
      return;
    }
    if (apiKeyManager.isActive()) {
      apiKeyManager.close();
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
    if (apiKeyManager.isActive()) {
      apiKeyManager.close();
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
    tui.stop();
    process.exit(0);
  };

  const renderMainView = () => {
    root.clear();
    root.addChild(intro);
    root.addChild(chatLog);
    if (lastError ?? agentRunner.error) {
      root.addChild(errorText);
    }
    if (agentRunner.workingState.status !== 'idle') {
      root.addChild(workingIndicator);
    }
    root.addChild(new Spacer(1));
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
    // --- API Key Manager (/keys command) ---
    const keyManagerState = apiKeyManager.state;

    if (keyManagerState.appState === 'provider_select') {
      const selector = createKeyManagerSelector(keyManagerState.keys, (envVar) =>
        apiKeyManager.handleKeySelect(envVar),
      );
      renderScreenView(
        'API Keys',
        'Select a key to add or update. Keys are saved to your .env file.',
        selector,
        'Enter to edit · Esc to close',
        selector,
      );
      return;
    }

    if (keyManagerState.appState === 'key_input' && keyManagerState.selectedKey) {
      const { label, envVar } = keyManagerState.selectedKey;
      const input = new ApiKeyInputComponent(true);
      input.onSubmit = (value) => apiKeyManager.handleKeySubmit(value);
      input.onCancel = () => apiKeyManager.handleKeySubmit(null);
      renderScreenView(
        `Set ${label} Key`,
        `(${envVar})`,
        input,
        'Enter to save · Esc to go back',
        input,
      );
      return;
    }

    if (keyManagerState.appState === 'done') {
      const body = new Container();
      body.addChild(new Text(theme.success(`✓ ${keyManagerState.savedKeyLabel ?? 'API'} key saved to .env`), 0, 0));
      body.addChild(new Text('', 0, 0));
      body.addChild(new Text(theme.muted('Press any key to continue...'), 0, 0));
      const dismissOnKey = new class extends Container {
        handleInput(_keyData: string): void {
          apiKeyManager.dismissDone();
        }
      }();
      dismissOnKey.addChild(body);
      renderScreenView('API Keys', '', dismissOnKey, undefined, dismissOnKey);
      return;
    }

    // --- Halal Terminal key setup wizard ---
    const halalState = halalKey.state;

    if (halalState.appState === 'confirm') {
      const selector = createApiKeyConfirmSelector((wantsToSetUp) =>
        halalKey.handleConfirm(wantsToSetUp),
      );
      renderScreenView(
        'Halal Terminal API (free)',
        'Generate a free API key to enable Shariah compliance screening,\nzakat calculations, ETF analysis, and Islamic finance news.',
        selector,
        'No credit card required  ·  50 free tokens to start  ·  Enter to confirm · Esc to skip',
        selector,
      );
      return;
    }

    if (halalState.appState === 'email_input') {
      const input = new ApiKeyInputComponent(false);
      input.onSubmit = (email) => {
        void halalKey.handleEmailSubmit(email);
      };
      input.onCancel = () => halalKey.handleConfirm(false);
      renderScreenView(
        'Enter your email',
        'A free API key will be sent and saved automatically.',
        input,
        'Enter to confirm · Esc to skip',
        input,
      );
      return;
    }

    if (halalState.appState === 'generating') {
      const body = new Container();
      body.addChild(new Text(theme.muted('Generating your API key...'), 0, 0));
      renderScreenView('Halal Terminal API', '', body);
      return;
    }

    if (halalState.appState === 'done') {
      const body = new Container();
      body.addChild(new Text(theme.success('API key generated and saved to .env'), 0, 0));
      body.addChild(new Text(theme.muted(`Key: ${halalState.generatedKey ?? ''}`), 0, 0));
      body.addChild(new Text('', 0, 0));
      body.addChild(new Text(theme.muted('Press any key to continue...'), 0, 0));

      // Dismiss on any keypress
      const dismissOnKey = new class extends Container {
        handleInput(_keyData: string): void {
          halalKey.dismiss();
        }
      }();
      dismissOnKey.addChild(body);
      renderScreenView('Halal Terminal API', '', dismissOnKey, undefined, dismissOnKey);
      return;
    }

    if (halalState.appState === 'error') {
      const body = new Container();
      body.addChild(new Text(theme.error(`Error: ${halalState.errorMessage ?? 'Unknown error'}`), 0, 0));
      body.addChild(new Text('', 0, 0));
      body.addChild(new Text(theme.muted('Press Enter to retry · Esc to skip'), 0, 0));

      const retryOrSkip = new class extends Container {
        handleInput(keyData: string): void {
          if (keyData === '\r' || keyData === '\n') {
            halalKey.retryFromError();
          } else if (keyData === '\u001b') {
            halalKey.dismiss();
          }
        }
      }();
      retryOrSkip.addChild(body);
      renderScreenView('Halal Terminal API', '', retryOrSkip, undefined, retryOrSkip);
      return;
    }

    // --- end Halal Terminal wizard ---

    const state = modelSelection.state;
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
  // Show LLM key setup first if missing, then Halal Terminal wizard
  if (!modelSelection.startKeySetupIfNeeded()) {
    halalKey.startIfNeeded();
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
