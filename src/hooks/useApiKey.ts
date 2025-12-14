import { useState, useEffect } from 'react';
import { ensureApiKeyForModel } from '../utils/env.js';

interface UseApiKeyResult {
  apiKeyReady: boolean;
}

/**
 * Hook to check and ensure API key is available for the given model
 */
export function useApiKey(model: string): UseApiKeyResult {
  const [apiKeyReady, setApiKeyReady] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      const ready = await ensureApiKeyForModel(model);
      setApiKeyReady(ready);
      if (!ready) {
        console.error(`Cannot start without API key for ${model}`);
      }
    };
    checkApiKey();
  }, [model]);

  return { apiKeyReady };
}

