import { useState, useCallback, useEffect, useRef } from 'react';
import { UserMessageStore } from '../utils/user-message-store.js';

export interface UseInputHistoryResult {
  /** Current history value to display (null = user is typing fresh input) */
  historyValue: string | null;
  /** Navigate to older message (up arrow) */
  navigateUp: () => void;
  /** Navigate to newer message (down arrow) */
  navigateDown: () => void;
  /** Save a message to history */
  saveMessage: (message: string) => Promise<void>;
  /** Reset navigation back to typing mode */
  resetNavigation: () => void;
}

/**
 * Hook for managing input history navigation.
 * Allows users to scroll through previous messages using up/down arrows.
 * 
 * Navigation uses an index from the end of the messages array:
 * - historyIndex = -1: User is typing (not navigating history)
 * - historyIndex = 0: Most recent message
 * - historyIndex = N: N messages back from most recent
 */
export function useInputHistory(): UseInputHistoryResult {
  const storeRef = useRef<UserMessageStore>(new UserMessageStore());
  const [messages, setMessages] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Load messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      await storeRef.current.load();
      setMessages(storeRef.current.getMessageStrings());
    };
    loadMessages();
  }, []);

  // Navigate to older message (up arrow)
  const navigateUp = useCallback(() => {
    if (messages.length === 0) return;

    setHistoryIndex(prev => {
      const maxIndex = messages.length - 1;
      if (prev === -1) {
        // Start navigation from most recent
        return 0;
      } else if (prev < maxIndex) {
        // Move to older message
        return prev + 1;
      }
      // At oldest message, stay there
      return prev;
    });
  }, [messages.length]);

  // Navigate to newer message (down arrow)
  const navigateDown = useCallback(() => {
    setHistoryIndex(prev => {
      if (prev === -1) {
        // Already in typing mode, do nothing
        return -1;
      } else if (prev === 0) {
        // At most recent, go back to typing mode
        return -1;
      } else {
        // Move to newer message
        return prev - 1;
      }
    });
  }, []);

  // Save a new message to history
  const saveMessage = useCallback(async (message: string) => {
    await storeRef.current.append(message);
    setMessages(storeRef.current.getMessageStrings());
  }, []);

  // Reset navigation to typing mode
  const resetNavigation = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  // Compute the current history value based on index
  // Messages are stored oldest-to-newest, so we read from the end
  const historyValue = historyIndex === -1 
    ? null 
    : messages[messages.length - 1 - historyIndex] ?? null;

  return {
    historyValue,
    navigateUp,
    navigateDown,
    saveMessage,
    resetNavigation,
  };
}
