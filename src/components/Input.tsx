import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';
import { useTextBuffer } from '../hooks/useTextBuffer.js';
import { cursorHandlers } from '../utils/input-key-handlers.js';
import { CursorText } from './CursorText.js';
import { getSlashAutocomplete, getSlashCommandSuggestions } from '../commands.js';

interface InputProps {
  onSubmit: (value: string) => void;
  /** Value from history navigation (null = user typing fresh input) */
  historyValue?: string | null;
  /** Callback when user presses up/down arrow for history navigation */
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
}

function isShiftEnterEscapeSequence(input: string): boolean {
  return (
    input === '\u001b[27;2;13~' ||
    input === '[27;2;13~' ||
    input === '\u001b[13;2u' ||
    input === '[13;2u'
  );
}

function isCtrlBackspaceEscapeSequence(input: string): boolean {
  return (
    input === '\u001b[127;5u' ||
    input === '[127;5u' ||
    input === '\u001b[8;5u' ||
    input === '[8;5u' ||
    input === '\u001b[3;5~' ||
    input === '[3;5~'
  );
}

export function Input({ onSubmit, historyValue, onHistoryNavigate }: InputProps) {
  const { text, cursorPosition, actions } = useTextBuffer();
  const slashSuggestions = getSlashCommandSuggestions(text);
  const showSlashSuggestions = text.trim().startsWith('/') && slashSuggestions.length > 0;

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      actions.clear();
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      actions.setValue(historyValue);
    }
  }, [historyValue]);

  // Handle all input
  useInput((input, key) => {
    const ctx = { text, cursorPosition };

    // Some terminals encode Shift+Enter as a CSI sequence instead of a modified return key.
    if (input && isShiftEnterEscapeSequence(input)) {
      actions.insert('\n');
      return;
    }

    if (input && isCtrlBackspaceEscapeSequence(input)) {
      actions.deleteWordBackward();
      return;
    }

    // Up arrow: move cursor up if not on first line, else history navigation
    if (key.upArrow) {
      const newPos = cursorHandlers.moveUp(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('up');
      }
      return;
    }

    // Down arrow: move cursor down if not on last line, else history navigation
    if (key.downArrow) {
      const newPos = cursorHandlers.moveDown(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('down');
      }
      return;
    }

    // Cursor movement - left arrow (plain, no modifiers)
    if (key.leftArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveLeft(ctx));
      return;
    }

    // Cursor movement - right arrow (plain, no modifiers)
    if (key.rightArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveRight(ctx));
      return;
    }

    // Ctrl+A - move to beginning of current line
    if (key.ctrl && input === 'a') {
      actions.moveCursor(cursorHandlers.moveToLineStart(ctx));
      return;
    }

    // Ctrl+E - move to end of current line
    if (key.ctrl && input === 'e') {
      actions.moveCursor(cursorHandlers.moveToLineEnd(ctx));
      return;
    }

    // Option+Left (Mac) / Ctrl+Left (Windows) / Alt+B - word backward
    if ((key.meta && key.leftArrow) || (key.ctrl && key.leftArrow) || (key.meta && input === 'b')) {
      actions.moveCursor(cursorHandlers.moveWordBackward(ctx));
      return;
    }

    // Option+Right (Mac) / Ctrl+Right (Windows) / Alt+F - word forward
    if ((key.meta && key.rightArrow) || (key.ctrl && key.rightArrow) || (key.meta && input === 'f')) {
      actions.moveCursor(cursorHandlers.moveWordForward(ctx));
      return;
    }

    // Option+Backspace (Mac) / Ctrl+Backspace (Windows) - delete word backward
    if ((key.meta || key.ctrl) && (key.backspace || key.delete)) {
      actions.deleteWordBackward();
      return;
    }

    // Ctrl+W - delete word backward (shell-style)
    if (key.ctrl && input === 'w') {
      actions.deleteWordBackward();
      return;
    }

    // Handle backspace/delete - delete character before cursor
    if (key.backspace || key.delete) {
      actions.deleteBackward();
      return;
    }

    // Shift+Enter - insert newline for multi-line input
    if (key.return && key.shift) {
      actions.insert('\n');
      return;
    }

    // Tab - autocomplete slash commands (e.g. /h -> /help)
    if (key.tab) {
      const completed = getSlashAutocomplete(text);
      if (completed) {
        actions.setValue(completed);
      }
      return;
    }

    // Handle submit (plain Enter)
    if (key.return) {
      const val = text.trim();
      if (val) {
        onSubmit(val);
        actions.clear();
      }
      return;
    }

    // Handle regular character input - insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      actions.insert(input);
    }
  });

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.mutedDark}
      borderLeft={false}
      borderRight={false}
      width="100%"
    >
      <Box paddingX={1}>
        <Text color={colors.primary} bold>
          {'> '}
        </Text>
        <CursorText text={text} cursorPosition={cursorPosition} />
      </Box>
      {showSlashSuggestions && (
        <Box paddingX={1} marginBottom={1} flexDirection="column">
          {slashSuggestions.map((suggestion) => (
            <Text key={suggestion.command} color={colors.muted}>
              {suggestion.command} - {suggestion.description}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
