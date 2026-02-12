export function useFinanceSelection(onError?: (error: string) => void) {
  return {
    selectionState: null as any,
    financeProvider: null as any,
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
