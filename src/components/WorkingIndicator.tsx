import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';
import { getRandomThinkingVerb } from '../utils/thinking-verbs.js';

/**
 * Renders text with a shine effect that sweeps left-to-right
 */
function ShineText({ text, color, shineColor }: { text: string; color: string; shineColor: string }) {
  const [shinePos, setShinePos] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    if (isPaused) {
      // Wait 2 seconds before restarting the shine
      const timeout = setTimeout(() => {
        setShinePos(0);
        setIsPaused(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
    
    const interval = setInterval(() => {
      setShinePos((prev) => {
        const next = prev + 1;
        if (next >= text.length) {
          setIsPaused(true);
          return prev; // Keep at end position until pause completes
        }
        return next;
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [isPaused, text.length]);
  
  // Memoize the rendered parts for performance
  const parts = useMemo(() => {
    const result: React.ReactNode[] = [];
    for (let i = 0; i < text.length; i++) {
      // Highlight characters within 1.25 of shine position (~2.5 char width)
      const isShine = !isPaused && Math.abs(i - shinePos) < 1.25;
      result.push(
        <Text key={i} color={isShine ? shineColor : color}>
          {text[i]}
        </Text>
      );
    }
    return result;
  }, [text, shinePos, isPaused, color, shineColor]);
  
  return <>{parts}</>;
}

export type WorkingState = 
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool'; toolName: string }
  | { status: 'answering'; startTime: number };

interface WorkingIndicatorProps {
  state: WorkingState;
}

/**
 * Persistent status indicator shown above the input box while agent is working
 */
export function WorkingIndicator({ state }: WorkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [thinkingVerb, setThinkingVerb] = useState(getRandomThinkingVerb);
  const prevStatusRef = useRef<WorkingState['status']>('idle');
  
  // Pick a new random verb when transitioning into thinking/tool state
  useEffect(() => {
    const isThinking = state.status === 'thinking' || state.status === 'tool';
    const wasThinking = prevStatusRef.current === 'thinking' || prevStatusRef.current === 'tool';
    
    if (isThinking && !wasThinking) {
      setThinkingVerb(getRandomThinkingVerb());
    }
    
    prevStatusRef.current = state.status;
  }, [state.status]);
  
  // Track elapsed time only when answering
  useEffect(() => {
    if (state.status !== 'answering') {
      setElapsed(0);
      return;
    }
    
    const startTime = state.startTime;
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [state]);
  
  if (state.status === 'idle') {
    return null;
  }
  
  let statusWord: string;
  let suffixEnd: string;
  switch (state.status) {
    case 'thinking':
    case 'tool':
      statusWord = `${thinkingVerb}...`;
      suffixEnd = ' to interrupt)';
      break;
    case 'answering':
      statusWord = 'Answering';
      suffixEnd = ` to interrupt • ${elapsed}s)`;
      break;
  }
  
  return (
    <Box>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      <Text color={colors.primary}> </Text>
      <ShineText text={statusWord} color={colors.primary} shineColor={colors.primaryLight} />
      <Text color={colors.muted}> (</Text>
      <Text color={colors.muted} bold>esc</Text>
      <Text color={colors.muted}>{suffixEnd}</Text>
    </Box>
  );
}
