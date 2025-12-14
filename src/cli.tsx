import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { Spinner } from './components/Spinner.js';
import { AnswerBox } from './components/AnswerBox.js';
import { ModelSelector } from './components/ModelSelector.js';
import { QueueDisplay } from './components/QueueDisplay.js';
import { DebugMessages } from './components/DebugMessages.js';
import { StatusMessage } from './components/StatusMessage.js';
import { CurrentTurnView } from './components/CurrentTurnView.js';
import { CompletedTurnView } from './components/CompletedTurnView.js';

import { useQueryQueue } from './hooks/useQueryQueue.js';
import { useApiKey } from './hooks/useApiKey.js';
import { useAgentExecution } from './hooks/useAgentExecution.js';

import { getSetting, setSetting } from './utils/config.js';
import { ensureApiKeyForModel } from './utils/env.js';
import { MessageHistory } from './utils/message-history.js';

import { DEFAULT_MODEL } from './model/llm.js';
import { colors } from './theme.js';

import type { AppState, CompletedTurn } from './cli/types.js';

export function CLI() {
  const { exit } = useApp();

  const [state, setState] = useState<AppState>('idle');
  const [model, setModel] = useState(() => getSetting('model', DEFAULT_MODEL));
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<CompletedTurn[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const messageHistoryRef = useRef<MessageHistory>(new MessageHistory(model));

  const { apiKeyReady } = useApiKey(model);
  const { queue: queryQueue, enqueue, shift: shiftQueue, clear: clearQueue } = useQueryQueue();

  const {
    currentTurn,
    spinner,
    answerStream,
    debugMessages,
    processQuery,
    handleAnswerComplete: baseHandleAnswerComplete,
    cancelExecution,
  } = useAgentExecution({
    model,
    messageHistory: messageHistoryRef.current,
  });

  /**
   * Handles the completed answer and moves current turn to history
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    // Add to history before clearing current turn
    if (currentTurn) {
      setHistory(h => [...h, { ...currentTurn, answer }]);
    }
    baseHandleAnswerComplete(answer);
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
      if (!query.trim()) return;

      // Handle special commands even while running
      if (query.trim().toLowerCase() === 'exit' || query.trim().toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      if (query.trim() === '/model') {
        setState('model_select');
        return;
      }

      // Queue the query if already running
      if (state === 'running') {
        enqueue(query.trim());
        setInputValue('');
        return;
      }

      // Process immediately if idle
      setInputValue('');
      executeQuery(query.trim());
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
          // Update message history manager's model for summary generation
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

  return (
    <Box flexDirection="column">
      <Intro />

      {/* Render completed conversation history */}
      {history.map((turn) => (
        <CompletedTurnView key={turn.id} turn={turn} />
      ))}

      {/* Render current in-progress conversation */}
      {currentTurn && <CurrentTurnView turn={currentTurn} />}

      {/* Queued queries */}
      <QueueDisplay queries={queryQueue} />

      {/* Debug messages */}
      <DebugMessages messages={debugMessages} />

      {/* Status message */}
      <StatusMessage message={statusMessage} />

      {/* Streaming answer */}
      {answerStream && (
        <AnswerBox
          stream={answerStream}
          onStart={() => {}}
          onComplete={handleAnswerComplete}
        />
      )}

      {/* Spinner for async operations */}
      {spinner && (
        <Box marginTop={1}>
          <Spinner message={spinner} />
        </Box>
      )}

      {/* Input bar - always visible and interactive */}
        <Box marginTop={1}>
          <Input
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  );
}
