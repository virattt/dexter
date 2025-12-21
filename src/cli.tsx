#!/usr/bin/env bun
/**
 * CLI - Multi-phase Agent Interface
 * 
 * Uses the agent with Understand, Plan, and Task Loop phases.
 */
import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, Static, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { AnswerBox } from './components/AnswerBox.js';
import { ModelSelector } from './components/ModelSelector.js';
import { QueueDisplay } from './components/QueueDisplay.js';
import { StatusMessage } from './components/StatusMessage.js';
import { CurrentTurnView, AgentProgressView } from './components/AgentProgressView.js';
import { TaskListView } from './components/TaskListView.js';
import type { Task } from './agent/state.js';
import type { AgentProgressState } from './components/AgentProgressView.js';

import { useQueryQueue } from './hooks/useQueryQueue.js';
import { useApiKey } from './hooks/useApiKey.js';
import { useAgentExecution, ToolError } from './hooks/useAgentExecution.js';

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
  tasks: Task[];
  answer: string;
}

// ============================================================================
// Debug Section Component
// ============================================================================

const DebugSection = React.memo(function DebugSection({ errors }: { errors: ToolError[] }) {
  if (errors.length === 0) return null;

  const formatArgs = (args: Record<string, unknown>): string => {
    const entries = Object.entries(args);
    if (entries.length === 0) return '(no args)';
    return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
  };

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="single" borderColor="red">
      <Text color="red" bold>Debug: Tool Errors</Text>
      {errors.map((err, i) => (
        <Box key={i} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
          <Text color="yellow">Tool: {err.toolName}</Text>
          <Text color="cyan">Args: {formatArgs(err.args)}</Text>
          <Text color="gray">Error: {err.error}</Text>
        </Box>
      ))}
    </Box>
  );
});

const CompletedTurnView = React.memo(function CompletedTurnView({ turn }: { turn: CompletedTurn }) {
  // Mark all tasks as completed for display
  const completedTasks = turn.tasks.map(t => ({ ...t, status: 'completed' as const }));

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Query */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'> '}</Text>
        <Text>{turn.query}</Text>
      </Box>

      {/* Task list (completed) */}
      {completedTasks.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginLeft={2} flexDirection="column">
            <TaskListView tasks={completedTasks} />
          </Box>
        </Box>
      )}

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

  // Store the current turn's tasks when answer starts streaming
  const currentTasksRef = useRef<Task[]>([]);

  const messageHistoryRef = useRef<MessageHistory>(new MessageHistory(model));

  const { apiKeyReady } = useApiKey(model);
  const { queue: queryQueue, enqueue, shift: shiftQueue, clear: clearQueue } = useQueryQueue();

  const {
    currentTurn,
    answerStream,
    isProcessing,
    toolErrors,
    processQuery,
    handleAnswerComplete: baseHandleAnswerComplete,
    cancelExecution,
  } = useAgentExecution({
    model,
    messageHistory: messageHistoryRef.current,
  });

  // Capture tasks when answer stream starts
  useEffect(() => {
    if (answerStream && currentTurn) {
      currentTasksRef.current = [...currentTurn.state.tasks];
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
        tasks: currentTasksRef.current,
        answer,
      }]);
    }
    baseHandleAnswerComplete(answer);
    currentTasksRef.current = [];
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
          {/* Query + phase progress + task list */}
          <CurrentTurnView 
            query={currentTurn.query} 
            state={currentTurn.state} 
          />

          {/* Streaming answer (appears below progress) */}
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

      {/* Debug: Tool Errors */}
      <DebugSection errors={toolErrors} />

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
