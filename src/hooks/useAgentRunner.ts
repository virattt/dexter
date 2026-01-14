import { useState, useCallback } from 'react';
import { Agent } from '../v2/agent.js';
import { MessageHistory } from '../utils/message-history.js';
import type { HistoryItem, WorkingState } from '../v2/components/index.js';
import type { AgentConfig, AgentEvent, DoneEvent } from '../v2/index.js';

// ============================================================================
// Types
// ============================================================================

export interface UseAgentRunnerResult {
  // State
  history: HistoryItem[];
  workingState: WorkingState;
  error: string | null;
  isProcessing: boolean;
  
  // Actions
  runQuery: (query: string) => Promise<void>;
  setError: (error: string | null) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentRunner(
  agentConfig: AgentConfig,
  messageHistoryRef: React.RefObject<MessageHistory>
): UseAgentRunnerResult {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workingState, setWorkingState] = useState<WorkingState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  
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
        updateLastHistoryItem(item => ({
          answer: item.answer + event.text,
        }));
        break;
        
      case 'done': {
        const doneEvent = event as DoneEvent;
        updateLastHistoryItem(item => {
          // Add to message history for multi-turn context
          if (item.query && doneEvent.answer) {
            messageHistoryRef.current?.addMessage(item.query, doneEvent.answer).catch(() => {
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
  }, [updateLastHistoryItem, messageHistoryRef]);
  
  // Run a query through the agent
  const runQuery = useCallback(async (query: string) => {
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
      const agent = await Agent.create(agentConfig);
      const stream = agent.run(query, messageHistoryRef.current!);
      
      for await (const event of stream) {
        handleEvent(event);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      // Mark the history item as error
      setHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.status !== 'processing') return prev;
        return [...prev.slice(0, -1), { ...last, status: 'error' }];
      });
      setWorkingState({ status: 'idle' });
    }
  }, [agentConfig, messageHistoryRef, handleEvent]);
  
  // Check if currently processing
  const isProcessing = history.length > 0 && history[history.length - 1].status === 'processing';
  
  return {
    history,
    workingState,
    error,
    isProcessing,
    runQuery,
    setError,
  };
}
