import React from 'react';
import { Text } from 'ink';
import { colors } from '../theme.js';

interface MarkdownTextProps {
  children: string;
}

/**
 * Simple markdown renderer for terminal output.
 * Handles basic formatting: **bold**, `code`, and bullet lists.
 */
export function MarkdownText({ children }: MarkdownTextProps) {
  const lines = children.split('\n');

  return (
    <>
      {lines.map((line, index) => {
        // Handle bullet lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const content = line.trim().substring(2);
          return (
            <Text key={index}>
              {'  • '}{renderInlineMarkdown(content)}{'\n'}
            </Text>
          );
        }

        // Handle numbered lists
        const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
          return (
            <Text key={index}>
              {'  '}{numberedMatch[1]}{'. '}{renderInlineMarkdown(numberedMatch[2])}{'\n'}
            </Text>
          );
        }

        // Regular line
        return (
          <Text key={index}>
            {renderInlineMarkdown(line)}{index < lines.length - 1 ? '\n' : ''}
          </Text>
        );
      })}
    </>
  );
}

/**
 * Renders inline markdown formatting within a line.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Pattern to match **bold**, `code`, or regular text
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(
        <Text key={key++}>
          {text.substring(currentIndex, match.index)}
        </Text>
      );
    }

    const matched = match[0];

    // Handle **bold**
    if (matched.startsWith('**') && matched.endsWith('**')) {
      parts.push(
        <Text key={key++} bold>
          {matched.slice(2, -2)}
        </Text>
      );
    }
    // Handle `code`
    else if (matched.startsWith('`') && matched.endsWith('`')) {
      parts.push(
        <Text key={key++} color={colors.accent}>
          {matched.slice(1, -1)}
        </Text>
      );
    }

    currentIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(
      <Text key={key++}>
        {text.substring(currentIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : text;
}
