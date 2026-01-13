#!/usr/bin/env bun
/**
 * CLI V2 - Real-time agentic loop interface
 * Shows tool calls and progress in Claude Code style
 */
import React, { useState, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Input } from './components/Input.js';
import { Intro } from './components/Intro.js';
import { runAgent } from './v2/agent.js';
import { HistoryItemView, WorkingIndicator } from './v2/components/index.js';
import type { HistoryItem, WorkingState } from './v2/components/index.js';
import type { AgentConfig, AgentEvent, DoneEvent } from './v2/index.js';
import { DEFAULT_MODEL } from './model/llm.js';

// Load environment variables
config({ quiet: true });

// ============================================================================
// Main App
// ============================================================================

function App() {
  const { exit } = useApp();
  
  const [model] = useState(() => process.env.DEXTER_MODEL || DEFAULT_MODEL);
  
  // All queries, events, and answers live in history - no separate "current" state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workingState, setWorkingState] = useState<WorkingState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  
  const agentConfig: AgentConfig = {
    model,
    maxIterations: 10,
  };
  
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
        updateLastHistoryItem(item => ({
          answer: doneEvent.answer,
          status: 'complete' as const,
          duration: item.startTime ? Date.now() - item.startTime : undefined,
        }));
        setWorkingState({ status: 'idle' });
        break;
      }
    }
  }, [updateLastHistoryItem]);
  
  const handleSubmit = useCallback(async (query: string) => {
    // Handle exit
    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      exit();
      return;
    }
    
    // Ignore if already processing
    if (workingState.status !== 'idle') return;
    
    // Add to history immediately - this IS the message history
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
      const stream = runAgent(query, agentConfig);
      
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
  }, [workingState.status, agentConfig, exit, handleEvent]);
  
  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (workingState.status === 'idle') {
        console.log('\nGoodbye!');
        exit();
      }
      // TODO: Add cancellation support
    }
  });
  
  // Check if we're currently processing (last item is processing)
  const isProcessing = history.length > 0 && history[history.length - 1].status === 'processing';
  
  return (
    <Box flexDirection="column">
      <Intro provider="anthropic" model={model} />
      
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
        <Input onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}

// ============================================================================
// Entry Point
// ============================================================================

render(<App />);
