import { useState, useCallback, useRef } from 'react';
import { Agent } from '../agent/agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { HistoryItem, WorkingState } from '../components/index.js';
import type { AgentConfig, AgentEvent, DoneEvent } from '../agent/index.js';

// ============================================================================
// Types
// ============================================================================

export interface RunQueryResult {
  answer: string;
}

export interface UseAgentRunnerResult {
  // State
  history: HistoryItem[];
  workingState: WorkingState;
  error: string | null;
  isProcessing: boolean;
  
  // Actions
  runQuery: (query: string) => Promise<RunQueryResult | undefined>;
  cancelExecution: () => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentRunner(
  agentConfig: AgentConfig,
  inMemoryChatHistoryRef: React.RefObject<InMemoryChatHistory>
): UseAgentRunnerResult {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workingState, setWorkingState] = useState<WorkingState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Helper to update the last (processing) history item
  const updateLastHistoryItem = useCallback((
    updater: (item: HistoryItem) => Partial<HistoryItem>
  ) => {
    setHistory(prev => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      return [...prev.slice(0, -1), { ...last, ...updater(last) }];
    });
  }, []);
  
  // Handle agent events
  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'thinking':
        setWorkingState({ status: 'thinking' });
        updateLastHistoryItem(item => ({
          events: [...item.events, {
            id: `thinking-${Date.now()}`,
            event,
            completed: true,
          }],
        }));
        break;
        
      case 'tool_start': {
        const toolId = `tool-${event.tool}-${Date.now()}`;
        setWorkingState({ status: 'tool', toolName: event.tool });
        updateLastHistoryItem(item => ({
          activeToolId: toolId,
          events: [...item.events, {
            id: toolId,
            event,
            completed: false,
          }],
        }));
        break;
      }
        
      case 'tool_end':
        setWorkingState({ status: 'thinking' });
        updateLastHistoryItem(item => ({
          activeToolId: undefined,
          events: item.events.map(e => 
            e.id === item.activeToolId
              ? { ...e, completed: true, endEvent: event }
              : e
          ),
        }));
        break;
        
      case 'tool_error':
        setWorkingState({ status: 'thinking' });
        updateLastHistoryItem(item => ({
          activeToolId: undefined,
          events: item.events.map(e => 
            e.id === item.activeToolId
              ? { ...e, completed: true, endEvent: event }
              : e
          ),
        }));
        break;
        
      case 'answer_start':
        setWorkingState({ status: 'answering' });
        break;
        
      case 'answer_chunk':
        // Hide "Writing response..." once text starts appearing
        setWorkingState({ status: 'idle' });
        updateLastHistoryItem(item => ({
          answer: item.answer + event.text,
        }));
        break;
        
      case 'done': {
        const doneEvent = event as DoneEvent;
        updateLastHistoryItem(item => {
          // Add to message history for multi-turn context
          if (item.query && doneEvent.answer) {
            inMemoryChatHistoryRef.current?.addMessage(item.query, doneEvent.answer).catch(() => {
              // Silently ignore errors in adding to history
            });
          }
          return {
            answer: doneEvent.answer,
            status: 'complete' as const,
            duration: item.startTime ? Date.now() - item.startTime : undefined,
          };
        });
        setWorkingState({ status: 'idle' });
        break;
      }
    }
  }, [updateLastHistoryItem, inMemoryChatHistoryRef]);
  
  // Run a query through the agent
  const runQuery = useCallback(async (query: string): Promise<RunQueryResult | undefined> => {
    // Create abort controller for this execution
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Track the final answer to return
    let finalAnswer: string | undefined;
    
    // Add to history immediately
    const itemId = Date.now().toString();
    const startTime = Date.now();
    setHistory(prev => [...prev, {
      id: itemId,
      query,
      events: [],
      answer: '',
      status: 'processing',
      startTime,
    }]);
    setError(null);
    setWorkingState({ status: 'thinking' });
    
    try {
      const agent = await Agent.create({
        ...agentConfig,
        signal: abortController.signal,
      });
      const stream = agent.run(query, inMemoryChatHistoryRef.current!);
      
      for await (const event of stream) {
        // Capture the final answer from the done event
        if (event.type === 'done') {
          finalAnswer = (event as DoneEvent).answer;
        }
        handleEvent(event);
      }
      
      // Return the answer if we got one
      if (finalAnswer) {
        return { answer: finalAnswer };
      }
    } catch (e) {
      // Handle abort gracefully - mark as interrupted, not error
      if (e instanceof Error && e.name === 'AbortError') {
        setHistory(prev => {
          const last = prev[prev.length - 1];
          if (!last || last.status !== 'processing') return prev;
          return [...prev.slice(0, -1), { ...last, status: 'interrupted' }];
        });
        setWorkingState({ status: 'idle' });
        return undefined;
      }
      
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      // Mark the history item as error
      setHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.status !== 'processing') return prev;
        return [...prev.slice(0, -1), { ...last, status: 'error' }];
      });
      setWorkingState({ status: 'idle' });
      return undefined;
    } finally {
      abortControllerRef.current = null;
    }
  }, [agentConfig, inMemoryChatHistoryRef, handleEvent]);
  
  // Cancel the current execution
  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Mark current processing item as interrupted
    setHistory(prev => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      return [...prev.slice(0, -1), { ...last, status: 'interrupted' }];
    });
    setWorkingState({ status: 'idle' });
  }, []);
  
  // Check if currently processing
  const isProcessing = history.length > 0 && history[history.length - 1].status === 'processing';
  
  return {
    history,
    workingState,
    error,
    isProcessing,
    runQuery,
    cancelExecution,
    setError,
  };
}
