import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface AnswerBoxProps {
  stream?: AsyncGenerator<string>;
  text?: string;
  onStart?: () => void;
  onComplete?: (answer: string) => void;
}

export function AnswerBox({ stream, text, onStart, onComplete }: AnswerBoxProps) {
  const [content, setContent] = useState(text || '');
  const [isStreaming, setIsStreaming] = useState(!!stream);

  useEffect(() => {
    if (!stream) return;

    let collected = text || '';
    let started = false;
    
    (async () => {
      try {
        for await (const chunk of stream) {
          if (!started && chunk.trim()) {
            started = true;
            onStart?.();
          }
          collected += chunk;
          setContent(collected);
        }
      } finally {
        setIsStreaming(false);
        onComplete?.(collected);
      }
    })();
  }, [stream, onStart, onComplete, text]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        {content}
        {isStreaming && '▌'}
      </Text>
    </Box>
  );
}

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
