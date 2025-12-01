import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface AnswerBoxProps {
  stream?: AsyncGenerator<string>;
  text?: string;
  onComplete?: (answer: string) => void;
}

export function AnswerBox({ stream, text, onComplete }: AnswerBoxProps) {
  const [content, setContent] = useState(text || '');
  const [isStreaming, setIsStreaming] = useState(!!stream);

  useEffect(() => {
    if (!stream) return;

    let collected = text || '';
    
    (async () => {
      try {
        for await (const chunk of stream) {
          collected += chunk;
          setContent(collected);
        }
      } finally {
        setIsStreaming(false);
        onComplete?.(collected);
      }
    })();
  }, [stream, onComplete, text]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Answer:
      </Text>
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
    <Box marginTop={1}>
      <Text color={colors.primary} bold>
        You: {query}
      </Text>
    </Box>
  );
}
