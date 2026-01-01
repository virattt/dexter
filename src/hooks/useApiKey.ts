import { useState, useEffect } from 'react';
import { getApiKeyName, checkApiKeyExists } from '../utils/env.js';

interface UseApiKeyResult {
  apiKeyReady: boolean;
}

/**
 * Hook to check if API key is available for the given model
 */
export function useApiKey(model: string): UseApiKeyResult {
  const [apiKeyReady, setApiKeyReady] = useState(false);

  useEffect(() => {
    const apiKeyName = getApiKeyName(model);
    if (apiKeyName) {
      const ready = checkApiKeyExists(apiKeyName);
      setApiKeyReady(ready);
    } else {
      setApiKeyReady(false);
    }
  }, [model]);

  return { apiKeyReady };
}
