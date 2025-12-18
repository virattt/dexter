import { useState, useCallback, useRef } from 'react';
import { AgentV2, AgentV2Callbacks, ToolCallInfo, ToolCallResult } from '../agent/agent_v2.js';
import { Iteration, AgentState, ToolCallStep } from '../agent/schemas_v2.js';
import { MessageHistory } from '../utils/message-history.js';
import { generateId } from '../cli/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Current turn state for the v2 agent
 */
export interface CurrentTurnV2 {
  id: string;
  query: string;
  state: AgentState;
}

interface UseAgentExecutionV2Options {
  model: string;
  messageHistory: MessageHistory;
}

interface UseAgentExecutionV2Result {
  currentTurn: CurrentTurnV2 | null;
  answerStream: AsyncGenerator<string> | null;
  isProcessing: boolean;
  processQuery: (query: string) => Promise<void>;
  handleAnswerComplete: (answer: string) => void;
  cancelExecution: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook that encapsulates agent execution logic including:
 * - Iteration tracking
 * - Thinking/tool call state management
 * - Query processing
 * - Answer handling
 */
export function useAgentExecutionV2({
  model,
  messageHistory,
}: UseAgentExecutionV2Options): UseAgentExecutionV2Result {
  const [currentTurn, setCurrentTurn] = useState<CurrentTurnV2 | null>(null);
  const [answerStream, setAnswerStream] = useState<AsyncGenerator<string> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentQueryRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  /**
   * Creates a new empty iteration
   */
  const createIteration = useCallback((id: number): Iteration => ({
    id,
    thinking: null,
    toolCalls: [],
    status: 'thinking',
  }), []);

  /**
   * Updates the current iteration's thinking
   */
  const setIterationThinking = useCallback((thought: string) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      const iterations = [...prev.state.iterations];
      const currentIdx = iterations.length - 1;
      if (currentIdx >= 0) {
        iterations[currentIdx] = {
          ...iterations[currentIdx],
          thinking: { thought },
        };
      }
      return {
        ...prev,
        state: {
          ...prev.state,
          iterations,
        },
      };
    });
  }, []);

  /**
   * Adds tool calls to the current iteration
   */
  const addToolCalls = useCallback((toolCalls: ToolCallInfo[]) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      const iterations = [...prev.state.iterations];
      const currentIdx = iterations.length - 1;
      if (currentIdx >= 0) {
        const newToolCalls: ToolCallStep[] = toolCalls.map(tc => ({
          toolName: tc.name,
          args: tc.args,
          summary: '',
          status: 'running' as const,
        }));
        iterations[currentIdx] = {
          ...iterations[currentIdx],
          status: 'acting',
          toolCalls: newToolCalls,
        };
      }
      return {
        ...prev,
        state: {
          ...prev.state,
          status: 'executing',
          iterations,
        },
      };
    });
  }, []);

  /**
   * Updates a tool call's status and summary
   */
  const updateToolCall = useCallback((result: ToolCallResult) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      const iterations = [...prev.state.iterations];
      const currentIdx = iterations.length - 1;
      if (currentIdx >= 0) {
        const toolCalls = iterations[currentIdx].toolCalls.map(tc => {
          if (tc.toolName === result.name && JSON.stringify(tc.args) === JSON.stringify(result.args)) {
            return {
              ...tc,
              summary: result.summary,
              status: result.success ? 'completed' as const : 'failed' as const,
            };
          }
          return tc;
        });
        iterations[currentIdx] = {
          ...iterations[currentIdx],
          toolCalls,
        };
      }
      return {
        ...prev,
        state: {
          ...prev.state,
          iterations,
        },
      };
    });
  }, []);

  /**
   * Marks the current iteration as complete and prepares for next
   */
  const completeIteration = useCallback((iterationNum: number) => {
    setCurrentTurn(prev => {
      if (!prev) return prev;
      const iterations = [...prev.state.iterations];
      const idx = iterationNum - 1;
      if (idx >= 0 && idx < iterations.length) {
        iterations[idx] = {
          ...iterations[idx],
          status: 'completed',
        };
      }
      return {
        ...prev,
        state: {
          ...prev.state,
          iterations,
        },
      };
    });
  }, []);

  /**
   * Creates agent callbacks that update the declarative state
   */
  const createAgentCallbacks = useCallback((): AgentV2Callbacks => ({
    onIterationStart: (iteration) => {
      setCurrentTurn(prev => {
        if (!prev) return prev;
        const newIteration = createIteration(iteration);
        return {
          ...prev,
          state: {
            ...prev.state,
            status: 'reasoning',
            currentIteration: iteration,
            iterations: [...prev.state.iterations, newIteration],
          },
        };
      });
    },
    onThinking: setIterationThinking,
    onToolCallsStart: addToolCalls,
    onToolCallComplete: updateToolCall,
    onIterationComplete: completeIteration,
    onAnswerStart: () => {
      setCurrentTurn(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          state: {
            ...prev.state,
            status: 'answering',
          },
        };
      });
    },
    onAnswerStream: (stream) => setAnswerStream(stream),
  }), [createIteration, setIterationThinking, addToolCalls, updateToolCall, completeIteration]);

  /**
   * Handles the completed answer
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    setCurrentTurn(null);
    setAnswerStream(null);

    // Add to message history for multi-turn context
    const query = currentQueryRef.current;
    if (query && answer) {
      messageHistory.addMessage(query, answer).catch(() => {
        // Silently ignore errors in adding to history
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

      // Store current query for message history
      currentQueryRef.current = query;

      // Initialize turn state
      setCurrentTurn({
        id: generateId(),
        query,
        state: {
          iterations: [],
          currentIteration: 0,
          status: 'reasoning',
        },
      });

      const callbacks = createAgentCallbacks();

      try {
        const agent = new AgentV2({ model, callbacks });
        await agent.run(query, messageHistory);
      } catch (e) {
        setCurrentTurn(null);
        currentQueryRef.current = null;
        throw e;
      } finally {
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
    setCurrentTurn(null);
    setAnswerStream(null);
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  return {
    currentTurn,
    answerStream,
    isProcessing,
    processQuery,
    handleAnswerComplete,
    cancelExecution,
  };
}
