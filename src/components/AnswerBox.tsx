import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface AnswerBoxProps {
  stream?: AsyncGenerator<string>;
  text?: string;
  onStart?: () => void;
  onComplete?: (answer: string) => void;
}

export const AnswerBox = React.memo(function AnswerBox({ stream, text, onStart, onComplete }: AnswerBoxProps) {
  const [content, setContent] = useState(text || '');
  const [isStreaming, setIsStreaming] = useState(!!stream);

  // Store callbacks in refs to avoid effect re-runs when references change
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  // Sync content with text prop when not streaming (used by V2 CLI)
  useEffect(() => {
    if (!stream && text !== undefined) {
      setContent(text);
    }
  }, [stream, text]);

  useEffect(() => {
    if (!stream) return;

    let collected = text || '';
    let started = false;
    
    (async () => {
      try {
        for await (const chunk of stream) {
          if (!started && chunk.trim()) {
            started = true;
            onStartRef.current?.();
          }
          collected += chunk;
          setContent(collected);
        }
      } finally {
        setIsStreaming(false);
        onCompleteRef.current?.(collected);
      }
    })();
  }, [stream, text]);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.muted}>⏺ </Text>
        <Text>
          {content}
          {isStreaming && '▌'}
        </Text>
      </Box>
    </Box>
  );
});

interface UserQueryProps {
  query: string;
}

export function UserQuery({ query }: UserQueryProps) {
  return (
    <Box marginTop={1} paddingRight={2}>
      <Text color={colors.white} backgroundColor={colors.mutedDark}>
        {'>'} {query}{' '}
      </Text>
    </Box>
  );
}