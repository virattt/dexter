#!/usr/bin/env bun
/**
 * CLI - Real-time agentic loop interface
 * Shows tool calls and progress in Claude Code style
 */
import React, { useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Input } from './components/Input.js';
import { Intro } from './components/Intro.js';
import { ProviderSelector, ModelSelector } from './components/ModelSelector.js';
import { ApiKeyConfirm, ApiKeyInput } from './components/ApiKeyPrompt.js';
import { DebugPanel } from './components/DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './components/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';

import { useModelSelection } from './hooks/useModelSelection.js';
import { useAgentRunner } from './hooks/useAgentRunner.js';
import { useInputHistory } from './hooks/useInputHistory.js';

// Load environment variables
config({ quiet: true });

export function CLI() {
  const { exit } = useApp();
  
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
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInSelectionFlow,
  } = useModelSelection((errorMsg) => setErrorRef.current?.(errorMsg));
  
  // Agent execution state and handlers
  const {
    history,
    workingState,
    error,
    isProcessing,
    runQuery,
    cancelExecution,
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
    // Handle exit
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      exit();
      return;
    }
    
    // Handle model selection command
    if (query === '/model') {
      startSelection();
      return;
    }
    
    // Ignore if not idle (processing or in selection flow)
    if (isInSelectionFlow() || workingState.status !== 'idle') return;
    
    // Save user message to history immediately and reset navigation
    await saveMessage(query);
    resetNavigation();
    
    // Run query and save agent response when complete
    const result = await runQuery(query);
    if (result?.answer) {
      await updateAgentResponse(result.answer);
    }
  }, [exit, startSelection, isInSelectionFlow, workingState.status, runQuery, saveMessage, updateAgentResponse, resetNavigation]);
  
  // Handle keyboard shortcuts
  useInput((input, key) => {
    // Escape key - cancel selection flows or running agent
    if (key.escape) {
      if (isInSelectionFlow()) {
        cancelSelection();
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
      } else if (isProcessing) {
        cancelExecution();
      } else {
        console.log('\nGoodbye!');
        exit();
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
  
  // Main chat interface
  return (
    <Box flexDirection="column">
      <Intro provider={provider} model={model} />
      
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
