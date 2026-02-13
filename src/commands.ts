export interface CommandDef {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: readonly CommandDef[] = [
  { command: '/help', description: 'Show available commands' },
  { command: '/new', description: 'Start a new session (clear context)' },
  { command: '/model', description: 'Switch model/provider' },
  { command: '/finance', description: 'Configure finance provider/API key' },
  { command: '/search', description: 'Configure web search provider/API key' },
  { command: '/web-search', description: 'Alias for /search' },
] as const;

export const TEXT_COMMANDS: readonly CommandDef[] = [
  { command: 'exit', description: 'Exit Dexter' },
  { command: 'quit', description: 'Exit Dexter' },
] as const;

export function getSlashCommandSuggestions(input: string): readonly CommandDef[] {
  const normalized = input.trim().toLowerCase();
  if (!normalized.startsWith('/')) return [];

  if (normalized === '/') return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter(({ command }) => command.startsWith(normalized));
}

export function getCommandsHelpText(): string {
  const slash = SLASH_COMMANDS.map(({ command, description }) => `  ${command} - ${description}`).join('\n');
  const text = TEXT_COMMANDS.map(({ command, description }) => `  ${command} - ${description}`).join('\n');
  return `Commands:\n${slash}\n\nAlso:\n${text}`;
}

export function getSlashAutocomplete(input: string): string | null {
  const suggestions = getSlashCommandSuggestions(input);
  if (suggestions.length !== 1) return null;
  return suggestions[0]?.command ?? null;
}
