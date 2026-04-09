export interface SlashCommand {
  name: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'model', description: 'Switch LLM provider and model' },
  { name: 'rules', description: 'Show your research rules' },
  { name: 'clear', description: 'Clear the conversation' },
  { name: 'memory', description: 'Show what Dexter remembers about you' },
  { name: 'heartbeat', description: 'Show your heartbeat monitoring checklist' },
  { name: 'history', description: 'Show recent conversation summaries' },
  { name: 'help', description: 'Show keyboard shortcuts and tips' },
];

/**
 * Filter commands matching the current input.
 * Input should start with "/". Bare "/" returns all commands.
 */
export function matchCommands(input: string): SlashCommand[] {
  const query = input.slice(1).toLowerCase();
  if (query === '') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(cmd => cmd.name.startsWith(query));
}
