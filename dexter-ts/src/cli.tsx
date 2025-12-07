import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { Spinner } from './components/Spinner.js';
import { TaskProgress, TaskState, DisplayStatus, taskToState, plannedTaskToState } from './components/TaskProgress.js';
import { AnswerBox, UserQuery } from './components/AnswerBox.js';
import { ModelSelector } from './components/ModelSelector.js';
import { QueueDisplay } from './components/QueueDisplay.js';
import { Agent, AgentCallbacks } from './agent/agent.js';
import { getSetting, setSetting } from './utils/config.js';
import { ensureApiKeyForModel } from './utils/env.js';
import { DEFAULT_MODEL } from './model/llm.js';
import { colors } from './theme.js';
import { useQueryQueue } from './hooks/useQueryQueue.js';
import { MessageHistory } from './utils/message-history.js';
import type { Task, PlannedTask } from './agent/schemas.js';

type AppState = 'idle' | 'running' | 'model_select';

/**
 * Represents a completed conversation turn (query + answer)
 */
interface CompletedTurn {
  id: string;
  query: string;
  tasks: TaskState[];
  answer: string;
}

/**
 * Represents the current in-progress conversation turn
 */
interface CurrentTurn {
  id: string;
  query: string;
  tasks: TaskState[];
}

/**
 * Generate a unique ID for turns
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Renders a completed conversation turn
 */
function CompletedTurnView({ turn }: { turn: CompletedTurn }) {
  return (
    <Box flexDirection="column">
      <UserQuery query={turn.query} />
      {turn.tasks.length > 0 && <TaskProgress tasks={turn.tasks} title="Completed Tasks" />}
      <AnswerBox text={turn.answer} />
    </Box>
  );
}

export function CLI() {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>('idle');
  const [inputValue, setInputValue] = useState('');
  const [model, setModel] = useState(() => getSetting('model', DEFAULT_MODEL));
  
  // New declarative state model
  const [history, setHistory] = useState<CompletedTurn[]>([]);
  const [currentTurn, setCurrentTurn] = useState<CurrentTurn | null>(null);
  
  // Message history for multi-turn conversations (persists across agent instances)
  const messageHistoryRef = useRef<MessageHistory>(new MessageHistory(model));
  
  // Track the current query being processed (for adding to message history with answer)
  const currentQueryRef = useRef<string | null>(null);
  
  // Query queue for handling multiple queries
  const { queue: queryQueue, enqueue, shift: shiftQueue, clear: clearQueue } = useQueryQueue();
  const isProcessingRef = useRef(false);
  
  // UI state
  const [spinner, setSpinner] = useState<string | null>(null);
  const [answerStream, setAnswerStream] = useState<AsyncGenerator<string> | null>(null);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  useEffect(() => {
    const checkApiKey = async () => {
      const ready = await ensureApiKeyForModel(model);
      setApiKeyReady(ready);
      if (!ready) {
        console.error(`Cannot start without API key for ${model}`);
      }
    };
    checkApiKey();
  }, [model]);

  /**
   * Updates a task's status in the current turn
   */
  const updateTaskStatus = useCallback((taskId: number, status: DisplayStatus) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId ? { ...task, status } : task
        ),
      };
    });
  }, []);

  /**
   * Updates a subtask's status in the current turn
   */
  const updateSubTaskStatus = useCallback((taskId: number, subTaskId: number, status: DisplayStatus) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                subTasks: task.subTasks.map(st =>
                  st.id === subTaskId ? { ...st, status } : st
                ),
              }
            : task
        ),
      };
    });
  }, []);

  /**
   * Handles the completed answer and moves current turn to history
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    setCurrentTurn(prev => {
      if (prev) {
        // Move completed turn to history
        setHistory(h => [...h, { ...prev, answer }]);
      }
      return null;
    });
    setAnswerStream(null);
    
    // Add to message history for multi-turn context
    const query = currentQueryRef.current;
    if (query && answer) {
      // Add message asynchronously (summary generation happens in background)
      messageHistoryRef.current.addMessage(query, answer).catch(() => {
        // Silently ignore errors in adding to history - not critical
      });
    }
    currentQueryRef.current = null;
  }, []);

  /**
   * Creates agent callbacks that update the declarative state
   */
  const createAgentCallbacks = useCallback((): AgentCallbacks => ({
    onUserQuery: (query) => {
      setCurrentTurn({
        id: generateId(),
        query,
        tasks: [],
      });
    },
    onTasksPlanned: (tasks: Task[]) => {
      setCurrentTurn(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: tasks.map(taskToState),
        };
      });
    },
    onSubtasksPlanned: (plannedTasks: PlannedTask[]) => {
      setCurrentTurn(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: plannedTasks.map(plannedTaskToState),
        };
      });
    },
    onSubTaskStart: (taskId, subTaskId) => {
      updateSubTaskStatus(taskId, subTaskId, 'running');
    },
    onSubTaskComplete: (taskId, subTaskId, success) => {
      updateSubTaskStatus(taskId, subTaskId, success ? 'completed' : 'failed');
    },
    onTaskStart: (taskId) => {
      updateTaskStatus(taskId, 'running');
    },
    onTaskComplete: (taskId, success) => {
      updateTaskStatus(taskId, success ? 'completed' : 'failed');
    },
    onDebug: (msg) => {
      setDebugMessages(prev => [...prev, msg]);
    },
    onSpinnerStart: (msg) => setSpinner(msg),
    onSpinnerStop: () => {
      setSpinner(null);
    },
    onAnswerStream: (stream) => setAnswerStream(stream),
  }), [updateSubTaskStatus, updateTaskStatus]);

  /**
   * Processes a single query through the agent
   */
  const processQuery = useCallback(
    async (query: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setState('running');
      setDebugMessages([]);
      
      // Store current query for message history
      currentQueryRef.current = query;

      const callbacks = createAgentCallbacks();

      try {
        const agent = new Agent({ model, callbacks });
        // Pass message history for multi-turn context
        await agent.run(query, messageHistoryRef.current);
      } catch (e) {
        if ((e as Error).message?.includes('interrupted')) {
          setStatusMessage('Operation cancelled.');
        } else {
          setStatusMessage(`Error: ${e}`);
        }
        // Clear current turn on error
        setCurrentTurn(null);
        currentQueryRef.current = null;
      } finally {
        setState('idle');
        setSpinner(null);
        isProcessingRef.current = false;
      }
    },
    [model, createAgentCallbacks]
  );

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
      processQuery(query.trim());
    },
    [state, exit, enqueue, processQuery]
  );

  /**
   * Process next queued query when state becomes idle
   */
  useEffect(() => {
    if (state === 'idle' && queryQueue.length > 0 && !isProcessingRef.current) {
      const nextQuery = queryQueue[0];
      shiftQueue();
      processQuery(nextQuery);
    }
  }, [state, queryQueue, shiftQueue, processQuery]);

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
        setSpinner(null);
        setCurrentTurn(null);
        clearQueue();
        isProcessingRef.current = false;
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
      {currentTurn && (
        <Box flexDirection="column">
          <UserQuery query={currentTurn.query} />
          {currentTurn.tasks.length > 0 && (
            <TaskProgress tasks={currentTurn.tasks} />
          )}
        </Box>
      )}

      {/* Spinner for async operations */}
      {spinner && (
        <Box marginTop={1}>
          <Spinner message={spinner} />
        </Box>
      )}

      {/* Queued queries */}
      <QueueDisplay queries={queryQueue} />

      {/* Debug messages */}
      {debugMessages.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {debugMessages.map((msg, i) => (
            <Text key={i} dimColor>[DEBUG] {msg}</Text>
          ))}
        </Box>
      )}

      {/* Status message */}
      {statusMessage && (
        <Box marginTop={1}>
          <Text dimColor>{statusMessage}</Text>
        </Box>
      )}

      {/* Streaming answer */}
      {answerStream && <AnswerBox stream={answerStream} onComplete={handleAnswerComplete} />}

      {/* Input bar - always visible and interactive */}
      {apiKeyReady && (
        <Box marginTop={1}>
          <Input
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
          />
        </Box>
      )}

      {/* API key error */}
      {!apiKeyReady && (
        <Box marginTop={1}>
          <Text color={colors.error}>API key not configured. Please restart and enter your API key.</Text>
        </Box>
      )}
    </Box>
  );
}
