import { useState, useCallback } from 'react';

interface UseQueryQueueResult {
  queue: string[];
  enqueue: (query: string) => void;
  shift: () => void;
  clear: () => void;
}

export function useQueryQueue(): UseQueryQueueResult {
  const [queue, setQueue] = useState<string[]>([]);

  const enqueue = useCallback((query: string) => {
    setQueue(prev => [...prev, query]);
  }, []);

  const shift = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  return { queue, enqueue, shift, clear };
}
