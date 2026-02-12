#!/usr/bin/env bun
/**
 * CLI - Real-time agentic loop interface
 * Shows tool calls and progress in Claude Code style
 */
import React, { useCallback, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Input } from './components/Input.js';
import { Intro } from './components/Intro.js';
import { ProviderSelector, ModelSelector, ModelInputField } from './components/ModelSelector.js';
import { ApiKeyConfirm, ApiKeyInput } from './components/ApiKeyPrompt.js';
import { WebSearchProviderSelector } from './components/WebSearchProviderSelector.js';
import { FinanceProviderSelector } from './components/FinanceProviderSelector.js';
import { DebugPanel } from './components/DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './components/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';
import { getWebSearchProviderDisplayName } from './tools/search/providers.js';
import { getFinanceProviderDisplayName } from './tools/finance/providers.js';

import { useModelSelection } from './hooks/useModelSelection.js';
import { useWebSearchSelection } from './hooks/useWebSearchSelection.js';
import { useFinanceSelection } from './hooks/useFinanceSelection.js';
import { useAgentRunner } from './hooks/useAgentRunner.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { getCommandsHelpText } from './commands.js';
import { colors } from './theme.js';

// Load environment variables
config({ quiet: true });

export function CLI() {
  const { exit } = useApp();
  const [notice, setNotice] = useState<string | null>(null);

  const terminateApp = useCallback(() => {
    // Exit Ink first, then force process termination on next tick so output can flush.
    exit();
    setTimeout(() => process.exit(0), 0);
  }, [exit]);
  
  // Ref to hold setError - avoids TDZ issue since useModelSelection needs to call
  // setError but useAgentRunner (which provides setError) depends on useModelSelection's outputs
  const setErrorRef = useRef<((error: string | null) => void) | null>(null);
  
  // Model selection state and handlers
  const {
    selectionState,
    provider,
    model,
    inMemoryChatHistoryRef,
    startSelection,
    cancelSelection,
    handleProviderSelect,
    handleModelSelect,
    handleModelInputSubmit,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInSelectionFlow,
  } = useModelSelection((errorMsg) => setErrorRef.current?.(errorMsg));

  // Web search provider selection state and handlers
  const {
    selectionState: webSearchSelectionState,
    webSearchProvider,
    startSelection: startWebSearchSelection,
    cancelSelection: cancelWebSearchSelection,
    handleProviderSelect: handleWebSearchProviderSelect,
    handleApiKeyConfirm: handleWebSearchApiKeyConfirm,
    handleApiKeySubmit: handleWebSearchApiKeySubmit,
    isInSelectionFlow: isInWebSearchSelectionFlow,
    getPendingProviderName,
    getPendingProviderApiKeyName,
  } = useWebSearchSelection((errorMsg) => setErrorRef.current?.(errorMsg));

  // Finance provider selection state and handlers
  const {
    selectionState: financeSelectionState,
    financeProvider,
    startSelection: startFinanceSelection,
    cancelSelection: cancelFinanceSelection,
    handleProviderSelect: handleFinanceProviderSelect,
    handleApiKeyConfirm: handleFinanceApiKeyConfirm,
    handleApiKeySubmit: handleFinanceApiKeySubmit,
    isInSelectionFlow: isInFinanceSelectionFlow,
    getPendingProviderName: getPendingFinanceProviderName,
    getPendingProviderApiKeyName: getPendingFinanceProviderApiKeyName,
  } = useFinanceSelection((errorMsg) => setErrorRef.current?.(errorMsg));
  
  // Agent execution state and handlers
  const {
    history,
    workingState,
    error,
    isProcessing,
    runQuery,
    cancelExecution,
    clearHistory,
    setError,
  } = useAgentRunner({ model, modelProvider: provider, maxIterations: 10 }, inMemoryChatHistoryRef);
  
  // Assign setError to ref so useModelSelection's callback can access it
  setErrorRef.current = setError;
  
  // Input history for up/down arrow navigation
  const {
    historyValue,
    navigateUp,
    navigateDown,
    saveMessage,
    updateAgentResponse,
    resetNavigation,
    clearHistory: clearInputHistory,
  } = useInputHistory();
  
  // Handle history navigation from Input component
  const handleHistoryNavigate = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up') {
      navigateUp();
    } else {
      navigateDown();
    }
  }, [navigateUp, navigateDown]);
  
  // Handle user input submission
  const handleSubmit = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();

    // Handle exit
    if (normalizedQuery.toLowerCase() === 'exit' || normalizedQuery.toLowerCase() === 'quit') {
      console.log('GoodBye!');
      terminateApp();
      return;
    }

    // Handle command help
    if (normalizedQuery === '/help' || normalizedQuery === '/') {
      setError(null);
      setNotice(getCommandsHelpText());
      return;
    }

    // Handle new session command
    if (normalizedQuery === '/new') {
      setNotice(null);
      if (isProcessing) {
        cancelExecution();
      }
      inMemoryChatHistoryRef.current?.clear();
      clearHistory();
      await clearInputHistory();
      resetNavigation();
      setError(null);
      setNotice('Started a new session. Context cleared.');
      return;
    }
    
    // Handle model selection command
    if (normalizedQuery === '/model') {
      setNotice(null);
      startSelection();
      return;
    }

    // Handle finance provider selection command
    if (normalizedQuery === '/finance') {
      setNotice(null);
      startFinanceSelection();
      return;
    }

    // Handle web search provider selection command
    if (normalizedQuery === '/search' || normalizedQuery === '/web-search') {
      setNotice(null);
      startWebSearchSelection();
      return;
    }

    // Handle unknown slash commands
    if (normalizedQuery.startsWith('/')) {
      setError(null);
      setNotice(`Unknown command: ${normalizedQuery}. ${getCommandsHelpText()}`);
      return;
    }
    
    // Ignore if not idle (processing or in selection flow)
    if (
      isInSelectionFlow() ||
      isInWebSearchSelectionFlow() ||
      isInFinanceSelectionFlow() ||
      workingState.status !== 'idle'
    ) return;

    setNotice(null);
    
    // Save user message to history immediately and reset navigation
    await saveMessage(normalizedQuery);
    resetNavigation();
    
    // Run query and save agent response when complete
    const result = await runQuery(normalizedQuery);
    if (result?.answer) {
      await updateAgentResponse(result.answer);
    }
  }, [terminateApp, startSelection, startWebSearchSelection, startFinanceSelection, isInSelectionFlow, isInWebSearchSelectionFlow, isInFinanceSelectionFlow, workingState.status, runQuery, saveMessage, updateAgentResponse, resetNavigation, setError, isProcessing, cancelExecution, inMemoryChatHistoryRef, clearHistory, clearInputHistory]);
  
  // Handle keyboard shortcuts
  useInput((input, key) => {
    // Escape key - cancel selection flows or running agent
    if (key.escape) {
      if (isInSelectionFlow()) {
        cancelSelection();
        return;
      }
      if (isInWebSearchSelectionFlow()) {
        cancelWebSearchSelection();
        return;
      }
      if (isInFinanceSelectionFlow()) {
        cancelFinanceSelection();
        return;
      }
      if (isProcessing) {
        cancelExecution();
        return;
      }
    }
    
    // Ctrl+C - cancel or exit
    if (key.ctrl && input === 'c') {
      if (isInSelectionFlow()) {
        cancelSelection();
      } else if (isInWebSearchSelectionFlow()) {
        cancelWebSearchSelection();
      } else if (isInFinanceSelectionFlow()) {
        cancelFinanceSelection();
      } else if (isProcessing) {
        cancelExecution();
      } else {
        console.log('\nGoodBye!');
        terminateApp();
      }
    }
  });
  
  // Render selection screens
  const { appState, pendingProvider, pendingModels } = selectionState;
  
  if (appState === 'provider_select') {
    return (
      <Box flexDirection="column">
        <ProviderSelector provider={provider} onSelect={handleProviderSelect} />
      </Box>
    );
  }
  
  if (appState === 'model_select' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelSelector
          providerId={pendingProvider}
          models={pendingModels}
          currentModel={provider === pendingProvider ? model : undefined}
          onSelect={handleModelSelect}
        />
      </Box>
    );
  }
  
  if (appState === 'model_input' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelInputField
          providerId={pendingProvider}
          currentModel={provider === pendingProvider ? model : undefined}
          onSubmit={handleModelInputSubmit}
        />
      </Box>
    );
  }
  
  if (appState === 'api_key_confirm' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm 
          providerName={getProviderDisplayName(pendingProvider)} 
          onConfirm={handleApiKeyConfirm} 
        />
      </Box>
    );
  }
  
  if (appState === 'api_key_input' && pendingProvider) {
    const apiKeyName = getApiKeyNameForProvider(pendingProvider) || '';
    return (
      <Box flexDirection="column">
        <ApiKeyInput 
          providerName={getProviderDisplayName(pendingProvider)}
          apiKeyName={apiKeyName}
          onSubmit={handleApiKeySubmit} 
        />
      </Box>
    );
  }

  const { appState: webSearchAppState } = webSearchSelectionState;
  if (webSearchAppState === 'provider_select') {
    return (
      <Box flexDirection="column">
        <WebSearchProviderSelector
          currentProvider={webSearchProvider}
          onSelect={handleWebSearchProviderSelect}
        />
      </Box>
    );
  }

  if (webSearchAppState === 'api_key_confirm') {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm
          providerName={getPendingProviderName()}
          onConfirm={handleWebSearchApiKeyConfirm}
        />
      </Box>
    );
  }

  if (webSearchAppState === 'api_key_input') {
    return (
      <Box flexDirection="column">
        <ApiKeyInput
          providerName={getPendingProviderName()}
          apiKeyName={getPendingProviderApiKeyName()}
          onSubmit={handleWebSearchApiKeySubmit}
        />
      </Box>
    );
  }

  const { appState: financeAppState } = financeSelectionState;
  if (financeAppState === 'provider_select') {
    return (
      <Box flexDirection="column">
        <FinanceProviderSelector
          currentProvider={financeProvider}
          onSelect={handleFinanceProviderSelect}
        />
      </Box>
    );
  }

  if (financeAppState === 'api_key_confirm') {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm
          providerName={getPendingFinanceProviderName()}
          onConfirm={handleFinanceApiKeyConfirm}
        />
      </Box>
    );
  }

  if (financeAppState === 'api_key_input') {
    return (
      <Box flexDirection="column">
        <ApiKeyInput
          providerName={getPendingFinanceProviderName()}
          apiKeyName={getPendingFinanceProviderApiKeyName()}
          onSubmit={handleFinanceApiKeySubmit}
        />
      </Box>
    );
  }
  
  // Main chat interface
  return (
    <Box flexDirection="column">
      <Intro provider={provider} model={model} />
      <Box marginBottom={1}>
        <Text color={colors.muted}>
          Finance: <Text color={colors.primary}>{getFinanceProviderDisplayName(financeProvider)}</Text>
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={colors.muted}>
          Web Search: <Text color={colors.primary}>{getWebSearchProviderDisplayName(webSearchProvider)}</Text>
        </Text>
      </Box>
      
      {/* All history items (queries, events, answers) */}
      {history.map(item => (
        <HistoryItemView key={item.id} item={item} />
      ))}
      
      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {notice && (
        <Box marginBottom={1}>
          <Text color={colors.info}>{notice}</Text>
        </Box>
      )}
      
      {/* Working indicator - only show when processing */}
      {isProcessing && <WorkingIndicator state={workingState} />}
      
      {/* Input */}
      <Box marginTop={1}>
        <Input 
          onSubmit={handleSubmit} 
          historyValue={historyValue}
          onHistoryNavigate={handleHistoryNavigate}
        />
      </Box>
      
      {/* Debug Panel - set show={false} to hide */}
      <DebugPanel maxLines={8} show={true} />
    </Box>
  );
}
