export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : JSON.stringify(error);
}
