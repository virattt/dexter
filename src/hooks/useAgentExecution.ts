import { useState, useCallback, useRef } from 'react';
import { Agent, AgentCallbacks, Task } from '../agent/agent.js';
import type { PlannedTask } from '../agent/schemas.js';
import { TaskState, DisplayStatus, taskToState, plannedTaskToState } from '../components/TaskProgress.js';
import { MessageHistory } from '../utils/message-history.js';
import { CurrentTurn, generateId } from '../cli/types.js';

interface UseAgentExecutionOptions {
  model: string;
  messageHistory: MessageHistory;
}

interface UseAgentExecutionResult {
  currentTurn: CurrentTurn | null;
  spinner: string | null;
  answerStream: AsyncGenerator<string> | null;
  debugMessages: string[];
  isProcessing: boolean;
  processQuery: (query: string) => Promise<void>;
  handleAnswerComplete: (answer: string) => void;
  cancelExecution: () => void;
}

/**
 * Hook that encapsulates agent execution logic including:
 * - Task status management
 * - Agent callbacks
 * - Query processing
 * - Answer handling
 */
export function useAgentExecution({
  model,
  messageHistory,
}: UseAgentExecutionOptions): UseAgentExecutionResult {
  const [currentTurn, setCurrentTurn] = useState<CurrentTurn | null>(null);
  const [spinner, setSpinner] = useState<string | null>(null);
  const [answerStream, setAnswerStream] = useState<AsyncGenerator<string> | null>(null);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentQueryRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

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
   * Handles the completed answer - returns the completed turn for history
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    setCurrentTurn(prev => {
      if (prev) {
        // Return the completed turn data via the callback
        // The parent will handle adding to history
      }
      return null;
    });
    setAnswerStream(null);

    // Add to message history for multi-turn context
    const query = currentQueryRef.current;
    if (query && answer) {
      messageHistory.addMessage(query, answer).catch(() => {
        // Silently ignore errors in adding to history - not critical
      });
    }
    currentQueryRef.current = null;
  }, [messageHistory]);

  /**
   * Processes a single query through the agent
   */
  const processQuery = useCallback(
    async (query: string): Promise<void> => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setDebugMessages([]);

      // Store current query for message history
      currentQueryRef.current = query;

      const callbacks = createAgentCallbacks();

      try {
        const agent = new Agent({ model, callbacks });
        await agent.run(query, messageHistory);
      } catch (e) {
        // Re-throw to let caller handle
        setCurrentTurn(null);
        currentQueryRef.current = null;
        throw e;
      } finally {
        setSpinner(null);
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [model, messageHistory, createAgentCallbacks]
  );

  /**
   * Cancels the current execution
   */
  const cancelExecution = useCallback(() => {
    setSpinner(null);
    setCurrentTurn(null);
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  return {
    currentTurn,
    spinner,
    answerStream,
    debugMessages,
    isProcessing,
    processQuery,
    handleAnswerComplete,
    cancelExecution,
  };
}

