#!/usr/bin/env bun
/**
 * CLI - Agent Interface
 * 
 * Uses the agent with iterative reasoning and progress display.
 */
import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, Static, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { AnswerBox, UserQuery } from './components/AnswerBox.js';
import { ModelSelector } from './components/ModelSelector.js';
import { QueueDisplay } from './components/QueueDisplay.js';
import { StatusMessage } from './components/StatusMessage.js';
import { CurrentTurnViewV2, AgentProgressView } from './components/AgentProgressView.js';
import type { Iteration } from './agent/schemas.js';

import { useQueryQueue } from './hooks/useQueryQueue.js';
import { useApiKey } from './hooks/useApiKey.js';
import { useAgentExecution } from './hooks/useAgentExecution.js';

import { getSetting, setSetting } from './utils/config.js';
import { ensureApiKeyForModel } from './utils/env.js';
import { MessageHistory } from './utils/message-history.js';

import { DEFAULT_MODEL } from './model/llm.js';
import { colors } from './theme.js';

import type { AppState } from './cli/types.js';

// Load environment variables
config({ quiet: true });

// ============================================================================
// Completed Turn Type and View
// ============================================================================

interface CompletedTurn {
  id: string;
  query: string;
  iterations: Iteration[];
  answer: string;
}

const CompletedTurnView = React.memo(function CompletedTurnView({ turn }: { turn: CompletedTurn }) {
  // Create a "done" state to render the completed iterations
  const completedState = {
    iterations: turn.iterations,
    currentIteration: turn.iterations.length,
    status: 'done' as const,
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Query */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'> '}</Text>
        <Text>{turn.query}</Text>
      </Box>

      {/* Thinking and tools (chronological) */}
      <AgentProgressView state={completedState} />

      {/* Answer */}
      <Box marginTop={1}>
        <AnswerBox text={turn.answer} />
      </Box>
    </Box>
  );
});

// ============================================================================
// Main CLI Component
// ============================================================================

export function CLI() {
  const { exit } = useApp();

  const [state, setState] = useState<AppState>('idle');
  const [model, setModel] = useState(() => getSetting('model', DEFAULT_MODEL));
  const [history, setHistory] = useState<CompletedTurn[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Store the current turn's iterations when answer starts streaming
  const currentIterationsRef = useRef<Iteration[]>([]);

  const messageHistoryRef = useRef<MessageHistory>(new MessageHistory(model));

  const { apiKeyReady } = useApiKey(model);
  const { queue: queryQueue, enqueue, shift: shiftQueue, clear: clearQueue } = useQueryQueue();

  const {
    currentTurn,
    answerStream,
    isProcessing,
    processQuery,
    handleAnswerComplete: baseHandleAnswerComplete,
    cancelExecution,
  } = useAgentExecution({
    model,
    messageHistory: messageHistoryRef.current,
  });

  // Capture iterations when answer stream starts
  useEffect(() => {
    if (answerStream && currentTurn) {
      currentIterationsRef.current = [...currentTurn.state.iterations];
    }
  }, [answerStream, currentTurn]);

  /**
   * Handles the completed answer and moves current turn to history
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    if (currentTurn) {
      setHistory(h => [...h, {
        id: currentTurn.id,
        query: currentTurn.query,
        iterations: currentIterationsRef.current,
        answer,
      }]);
    }
    baseHandleAnswerComplete(answer);
    currentIterationsRef.current = [];
  }, [currentTurn, baseHandleAnswerComplete]);

  /**
   * Wraps processQuery to handle state transitions and errors
   */
  const executeQuery = useCallback(
    async (query: string) => {
      setState('running');
      try {
        await processQuery(query);
      } catch (e) {
        if ((e as Error).message?.includes('interrupted')) {
          setStatusMessage('Operation cancelled.');
        } else {
          setStatusMessage(`Error: ${e}`);
        }
      } finally {
        setState('idle');
      }
    },
    [processQuery]
  );

  /**
   * Process next queued query when state becomes idle
   */
  useEffect(() => {
    if (state === 'idle' && queryQueue.length > 0) {
      const nextQuery = queryQueue[0];
      shiftQueue();
      executeQuery(nextQuery);
    }
  }, [state, queryQueue, shiftQueue, executeQuery]);

  const handleSubmit = useCallback(
    (query: string) => {
      // Handle special commands even while running
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      if (query === '/model') {
        setState('model_select');
        return;
      }

      // Queue the query if already running
      if (state === 'running') {
        enqueue(query);
        return;
      }

      // Process immediately if idle
      executeQuery(query);
    },
    [state, exit, enqueue, executeQuery]
  );

  const handleModelSelect = useCallback(
    async (modelId: string | null) => {
      if (modelId && modelId !== model) {
        const ready = await ensureApiKeyForModel(modelId);
        if (ready) {
          setModel(modelId);
          setSetting('model', modelId);
          messageHistoryRef.current.setModel(modelId);
          setStatusMessage(`Model changed to ${modelId}`);
        } else {
          setStatusMessage(`Cannot use model ${modelId} without API key.`);
        }
      }
      setState('idle');
    },
    [model]
  );

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state === 'running') {
        setState('idle');
        cancelExecution();
        clearQueue();
        setStatusMessage('Operation cancelled. You can ask a new question or press Ctrl+C again to quit.');
      } else {
        console.log('\nGoodbye!');
        exit();
      }
    }
  });

  if (state === 'model_select') {
    return (
      <Box flexDirection="column">
        <ModelSelector model={model} onSelect={handleModelSelect} />
      </Box>
    );
  }

  // Combine intro and history into a single static stream
  const staticItems: Array<{ type: 'intro' } | { type: 'turn'; turn: CompletedTurn }> = [
    { type: 'intro' },
    ...history.map(h => ({ type: 'turn' as const, turn: h })),
  ];

  return (
    <Box flexDirection="column">
      {/* Intro + completed history - each item rendered once, never re-rendered */}
      <Static items={staticItems}>
        {(item) =>
          item.type === 'intro' ? (
            <Intro key="intro" />
          ) : (
            <CompletedTurnView key={item.turn.id} turn={item.turn} />
          )
        }
      </Static>

      {/* Render current in-progress conversation */}
      {currentTurn && (
        <Box flexDirection="column" marginBottom={1}>
          {/* Query + thinking + tools */}
          <CurrentTurnViewV2 
            query={currentTurn.query} 
            state={currentTurn.state} 
          />

          {/* Streaming answer (appears below progress, chronologically) */}
          {answerStream && (
            <Box marginTop={1}>
              <AnswerBox
                stream={answerStream}
                onComplete={handleAnswerComplete}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Queued queries */}
      <QueueDisplay queries={queryQueue} />

      {/* Status message */}
      <StatusMessage message={statusMessage} />

      {/* Input bar - always visible and interactive */}
      <Box marginTop={1}>
        <Input onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
