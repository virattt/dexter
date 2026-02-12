export function useWebSearchSelection(onError?: (error: string) => void) {
  return {
    selectionState: null as any,
    webSearchProvider: null as any,
    startSelection: () => {},
    cancelSelection: () => {},
    handleProviderSelect: (provider: string) => {},
    handleApiKeyConfirm: () => {},
    handleApiKeySubmit: (key: string | null) => {},
    isInSelectionFlow: () => false,
    getPendingProviderName: () => '',
    getPendingProviderApiKeyName: () => '',
  };
}
