import { Container, ProcessTerminal, Spacer, Text, TUI } from '@mariozechner/pi-tui';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
import { getAuthStatus, getCredentialsPath, hasValidToken } from './tools/tastytrade/auth.js';

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
        if (tool === 'financial_search') {
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

const THETA_POLICY_PATH = join(homedir(), '.dexter', 'THETA-POLICY.md');

function buildThetaHelpQuery(): string {
  const hasThetaPolicy = existsSync(THETA_POLICY_PATH);
  const tastytradeEnvConfigured = Boolean(
    process.env.TASTYTRADE_CLIENT_ID && process.env.TASTYTRADE_CLIENT_SECRET,
  );
  const hasTastytradeToken = hasValidToken();
  const credentialsPath = getCredentialsPath();

  return `Give me the Phase 5 tastytrade operating loop for theta workflows.

Environment status:
- THETA-POLICY.md: ${hasThetaPolicy ? `present at ${THETA_POLICY_PATH}` : `missing (${THETA_POLICY_PATH})`}
- tastytrade env vars (client id + secret): ${tastytradeEnvConfigured ? 'configured' : 'missing or incomplete'}
- tastytrade credentials/token: ${hasTastytradeToken ? `looks usable (${credentialsPath})` : `missing or invalid (${credentialsPath})`}

Explain:
1. when to use /theta-policy
2. when to use /theta-risk
3. when to use /theta-scan
4. when to use /theta-preview
5. when to use /theta-repair
6. when to use /theta-roll
7. when to use /theta-btc-weekly (BTC options via IBIT, weekly Friday expiry)
8. when to use /hypersurface (Hypersurface advice only — optimal strike for BTC, I execute manually)
9. when to use /options (suggest options to execute on tastytrade that fit SOUL.md thesis)

Then tell me:
- the safest order to run them in for a normal trading day
- the safest order to run them in for a challenged short option
- what I should do first given the environment status above

Reference ~/.dexter/THETA-POLICY.md if it exists, and explicitly call out any missing setup before suggesting live broker workflows.`;
}

function buildTastytradeStatusQuery(): string {
  const status = getAuthStatus();
  return `Report my tastytrade setup status.

Current status:
- operator state: ${status.operatorState}
- configured (client id + secret set): ${status.configured}
- has credentials file: ${status.hasCredentials}
- credentials path: ${status.credentialsPath}
- message: ${status.message}

Operator states: not_connected (set env + credentials) -> read_only (accounts, positions, theta scan, strategy preview, order_dry_run) -> trading_enabled (also live_orders, submit_order, cancel_order when TASTYTRADE_ORDER_ENABLED=true).

Tell me what I need to do next. If not_connected, give exact steps to reach read_only. If read_only, say how to enable trading (TASTYTRADE_ORDER_ENABLED) and that submit/cancel require explicit approval. See docs/PRD-TASTYTRADE-INTEGRATION.md and env.example.`;
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

  const modelSelection = new ModelSelectionController(onError, () => {
    intro.setModel(modelSelection.model);
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

  const QUERY_SHORTCUTS: Record<string, string> = {
    '/suggest': `Suggest and save TWO portfolios based on your Identity (SOUL.md). Use two portfolios — zero overlap.

1. **Tastytrade sleeve** (portfolio_id=default): Only tickers NOT on Hyperliquid — e.g. AMAT, ASML, LRCX, KLAC, VRT, CEG, ANET (SOUL layers 1–7). Do NOT include TSM or any ticker tradable on HIP-3. 10–20 positions, target weights, layer/tier. Save to ~/.dexter/PORTFOLIO.md with portfolio tool, action=update, portfolio_id=default.

2. **Hyperliquid sleeve** (portfolio_id=hyperliquid): Only HIP-3 onchain equities — stocks (TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META), commodities (GLD, SLV), indices (SPY, SMH). Do NOT include BTC, SOL, HYPE, ETH, SUI, NEAR (those are in the core crypto portfolio). 10–20 positions, target weights. Save to ~/.dexter/PORTFOLIO-HYPERLIQUID.md with portfolio tool, action=update, portfolio_id=hyperliquid.

Include conviction tiering, regime awareness, and rationale. Call the portfolio tool twice to save both files.

**Also include a "Not in the portfolio — and why" section** for each sleeve: list thesis-universe names that were considered but excluded, with a one-line reason for each (e.g. crowding, valuation, wrong regime, insufficient moat, better expression elsewhere). The trades we don't make are thesis calls too.`,
    '/weekly': `Write a weekly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md for my holdings (or the portfolio you suggested last time). For each position, fetch the price change over the past 7 days (start_date and end_date). Also fetch the 7-day performance for:
- BTC-USD (Bitcoin)
- GLD (Gold ETF)
- SPY (S&P 500 ETF)

Output:
1. Portfolio return (weighted) for the week
2. Benchmark returns: BTC, GLD, SPY
3. Outperformance/underperformance vs each benchmark
4. Best and worst performers in the portfolio
5. One-line takeaway: did the portfolio beat BTC, Gold, and the S&P 500 this week?`,
    '/quarterly': `Write a quarterly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md. Fetch price data for the past 90 days (or quarter-to-date) for all holdings plus BTC-USD, GLD, and SPY. Include:
- Portfolio return (weighted) for the quarter
- Benchmark returns: BTC, Gold (GLD), S&P 500 (SPY)
- Outperformance/underperformance vs each
- Layer-level attribution: which layers (chip, equipment, power, etc.) contributed or detracted
- Conviction-tier performance: Core Compounders vs Cyclical vs Speculative
- Regime assessment: any sizing adjustments needed?
- Outlook for next quarter
- YTD and since-inception (if performance_history has data): compute and include vs BTC, SPY, GLD
- Save the report to ~/.dexter/QUARTERLY-REPORT-YYYY-QN.md using the save_report tool (e.g. QUARTERLY-REPORT-2026-Q1.md)
- Call performance_history record_quarter to append this quarter's returns (period, portfolio, btc, spy, gld as decimals)`,
    '/suggest-hl': `Suggest a Hyperliquid portfolio focused on HIP-3 onchain equities — NOT crypto assets (BTC, SOL, HYPE, ETH, SUI, NEAR are already in the core portfolio). Use docs/HYPERLIQUID-SYMBOL-MAP.md for the HL→FD ticker mapping. Include:
- 10–20 positions from HIP-3 onchain stocks (e.g. TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META, MSFT, AMZN, MU, INTC), commodities (GLD, SLV, USO), or indices (SPY, SMH)
- Do NOT allocate to BTC, SOL, HYPE, ETH, SUI, NEAR — those belong in the core portfolio
- Size by thesis conviction, not by volume. Volume matters for execution quality (spreads, slippage) but should not drive allocation weights
- Target weights and brief rationale
- Save to ~/.dexter/PORTFOLIO-HYPERLIQUID.md using the portfolio tool with portfolio_id=hyperliquid
- **"Not in the portfolio — and why"**: list HIP-3-eligible names from the thesis universe that were considered but excluded, with a one-line reason for each. The trades we don't make are thesis calls too.`,
    '/hl-report': `Write a quarterly performance report for my Hyperliquid portfolio only. Use ~/.dexter/PORTFOLIO-HYPERLIQUID.md. Map HL symbols to FD tickers per docs/HYPERLIQUID-SYMBOL-MAP.md. Fetch quarter-to-date (or 90-day) prices for each position plus BTC-USD, GLD, SPY. Include:
- Portfolio return vs BTC, SPY, GLD (and hl_basket if computable)
- Category attribution: Core, L1, AI infra, tokenization
- Best and worst performers
- Regime assessment and outlook
- YTD and since-inception if performance_history has data
- Save to ~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md via save_report
- Call performance_history record_quarter with portfolio_hl (and optionally hl_basket)`,
    '/hl-essay': `Using the Hyperliquid quarterly report from ~/.dexter/QUARTERLY-REPORT-HL-*.md (or the HL report you just produced), write a 600–800 word reflection essay on the on-chain stocks thesis. Structure:
1. What the numbers say — which HIP-3 categories validated (Core, L1, AI infra, tokenization), which didn't
2. The regime problem — what BTC/Gold/SPY told us for on-chain exposure
3. The machine's recommendation — sizing adjustments for the HL portfolio
4. One sentence that captures the tension between on-chain optionality and regime risk

Voice: structural thinking, precise numbers, blunt assessment. No hype. Output markdown ready for Claude polish or direct publish.`,
    '/theta-risk': `Analyze my live tastytrade options book. Use tastytrade_position_risk and tell me:
- my portfolio theta and delta
- which short options are challenged
- concentration by underlying
- whether any short position looks like assignment risk this week`,
    '/theta-scan': `Scan for the safest theta trade in my tastytrade account today. Use tastytrade_theta_scan with my THETA-POLICY defaults: underlyings from my SOUL.md thesis, non-crypto only (equities — equipment, foundry, chip, power, memory, networking). Do not default to SPX/SPY/QQQ or IBIT unless my policy or I explicitly ask for BTC. Policy is enforced as a hard block. When the tool returns table_summary, show that table (Underlying, Strategy, Strike(s), Credit, APR-like, Prob (ITM), DTE, Max loss). Also return the top 2 candidates with:
- strategy type
- strikes and expiration
- estimated credit
- max loss
- policy notes
- which one best fits my current book`,
    '/theta-preview': `Run a theta scan for a credit spread, pick the best candidate, then preview it before any submission. Use tastytrade_theta_scan followed by tastytrade_strategy_preview. If preview returns policy_blocked: true, do not recommend the trade. Show me:
- the chosen candidate
- the full trade memo
- the dry-run result
- your recommendation on whether I should place it
Do not submit anything.`,
    '/theta-repair': `Check whether any of my short options need repair. Use tastytrade_position_risk first, then tastytrade_repair_position on the most challenged short option. Tell me whether I should:
- hold
- roll
- close now
- or take assignment
Do not submit anything.`,
    '/theta-roll': `Find my most challenged short put and build a later-dated roll candidate. Use tastytrade_roll_short_option and show:
- current position
- target expiration and strike
- net credit or debit
- dry-run result
- your recommendation
Do not submit anything until I explicitly confirm.`,
    '/theta-btc-weekly': `Give me optimal strike advice for BTC options expiring this Friday (same calendar day as Hypersurface). This is for secured puts or covered calls on BTC that I execute on Hypersurface; tastytrade is used only for strike/APR/probability data — do not submit any order on tastytrade. Use tastytrade_theta_scan with underlyings_csv=IBIT (or BITO if the user prefers), min_dte=1, max_dte=7, strategy_type=cash_secured_put or credit_spread. When the tool returns table_summary, show that table. Recommend 1–2 best strikes for the week with brief rationale (credit vs probability trade-off). If IBIT is not in THETA-POLICY allowed underlyings, tell the user to add IBIT (or BITO/GBTC) to ~/.dexter/THETA-POLICY.md and rerun.`,
    '/hypersurface': `Advice for Hypersurface only — I will execute manually on Hypersurface; do not place any broker orders. Give me optimal strike advice for BTC options expiring this Friday (same calendar as Hypersurface weekly). Use tastytrade_theta_scan with underlyings_csv=IBIT (or BITO), min_dte=1, max_dte=7, strategy_type=cash_secured_put or credit_spread to get strike/APR/probability data. Show the table_summary and recommend 1–2 best strikes for secured puts or covered calls with brief rationale. If IBIT is not in THETA-POLICY allowed underlyings, tell me to add IBIT to ~/.dexter/THETA-POLICY.md and rerun.`,
    '/options': `Suggest options to execute on tastytrade that fit our thesis from SOUL.md. Use tastytrade_theta_scan with THETA-POLICY defaults: underlyings from SOUL.md only, non-crypto (equities — equipment, foundry, chip, power, memory, networking). Do not include SPX/SPY/QQQ or IBIT unless my policy lists them. Policy is a hard block. Show the table_summary (Underlying, Strategy, Strike(s), Credit, APR-like, Prob (ITM), DTE, Max loss) and recommend the top 2–3 candidates with strategy type, strikes, expiration, credit, max loss, and how each fits the thesis. Do not submit any order — I will preview and confirm before submitting.`,
    '/theta-policy': `Help me bootstrap ~/.dexter/THETA-POLICY.md. Read docs/THETA-POLICY.example.md and docs/THETA-POLICY.md, then:
1. show me the exact starter template
2. explain what each field controls
3. tell me what I should edit first for a conservative default policy
4. remind me which Phase 5 shortcuts to run after I create it
Do not place any trades.`,
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

    const expandedQuery =
      query === '/theta-help'
        ? buildThetaHelpQuery()
        : query === '/tastytrade-status'
          ? buildTastytradeStatusQuery()
          : QUERY_SHORTCUTS[query] ?? query;

    if (modelSelection.isInSelectionFlow() || agentRunner.pendingApproval || agentRunner.isProcessing) {
      return;
    }

    await inputHistory.saveMessage(expandedQuery);
    inputHistory.resetNavigation();
    const result = await agentRunner.runQuery(expandedQuery);
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
