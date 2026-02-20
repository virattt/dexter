import { Container, Input, SelectList, Text, type SelectItem, getEditorKeybindings } from '@mariozechner/pi-tui';
import { PROVIDERS, type Model } from '../utils/model.js';
import type { ApprovalDecision } from '../agent/types.js';
import { selectListTheme, theme } from '../theme.js';

class VimSelectList extends SelectList {
  handleInput(keyData: string): void {
    if (keyData === 'j') {
      super.handleInput('\u001b[B');
      return;
    }
    if (keyData === 'k') {
      super.handleInput('\u001b[A');
      return;
    }
    super.handleInput(keyData);
  }
}

class EmptyModelSelector extends Container {
  private readonly onCancel: () => void;

  constructor(providerId: string, onCancel: () => void) {
    super();
    this.onCancel = onCancel;
    this.addChild(new Text(theme.muted('No models available.'), 0, 0));
    if (providerId === 'ollama') {
      this.addChild(
        new Text(theme.muted('Make sure Ollama is running and you have models downloaded.'), 0, 0),
      );
    }
    this.addChild(new Text(theme.muted('esc to go back'), 0, 0));
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'selectCancel')) {
      this.onCancel();
    }
  }
}

export function createProviderSelector(
  currentProvider: string | undefined,
  onSelect: (providerId: string | null) => void,
) {
  const items: SelectItem[] = PROVIDERS.map((provider, index) => ({
    value: provider.providerId,
    label: `${index + 1}. ${provider.displayName}${currentProvider === provider.providerId ? ' ✓' : ''}`,
  }));
  const list = new VimSelectList(items, 8, selectListTheme);
  list.onSelect = (item) => onSelect(item.value);
  list.onCancel = () => onSelect(null);
  return list;
}

export function createModelSelector(
  models: Model[],
  currentModel: string | undefined,
  onSelect: (modelId: string | null) => void,
  providerId?: string,
) {
  if (models.length === 0) {
    return new EmptyModelSelector(providerId ?? '', () => onSelect(null));
  }
  const items: SelectItem[] = models.map((model, index) => ({
    value: model.id,
    label: `${index + 1}. ${model.displayName}${currentModel === model.id ? ' ✓' : ''}`,
  }));
  const list = new VimSelectList(items, 10, selectListTheme);
  list.onSelect = (item) => onSelect(item.value);
  list.onCancel = () => onSelect(null);
  return list;
}

export function createApprovalSelector(onSelect: (decision: ApprovalDecision) => void) {
  const items: SelectItem[] = [
    { value: 'allow-once', label: '1. Yes' },
    { value: 'allow-session', label: '2. Yes, allow all edits this session' },
    { value: 'deny', label: '3. No' },
  ];
  const list = new VimSelectList(items, 5, selectListTheme);
  list.onSelect = (item) => onSelect(item.value as ApprovalDecision);
  list.onCancel = () => onSelect('deny');
  return list;
}

export function createApiKeyConfirmSelector(onConfirm: (wantsToSet: boolean) => void) {
  const items: SelectItem[] = [
    { value: 'yes', label: '1. Yes' },
    { value: 'no', label: '2. No' },
  ];
  const list = new VimSelectList(items, 4, selectListTheme);
  list.onSelect = (item) => onConfirm(item.value === 'yes');
  list.onCancel = () => onConfirm(false);
  return list;
}

export class ApiKeyInputComponent {
  private readonly input = new Input();
  private readonly masked: boolean;
  onSubmit?: (apiKey: string | null) => void;
  onCancel?: () => void;

  constructor(masked = false) {
    this.masked = masked;
  }

  invalidate() {
    this.input.invalidate();
  }

  render(width: number): string[] {
    const lines = this.input.render(Math.max(10, width - 4));
    const raw = lines[0] ?? '';
    const display = this.masked
      ? `${'*'.repeat(this.input.getValue().length)}${this.input.getValue().length === 0 ? '█' : ''}`
      : raw;
    return [
      `${theme.primary('> ')}${display}`,
      theme.muted('Enter to confirm · Esc to cancel'),
    ];
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'submit')) {
      this.onSubmit?.(this.input.getValue().trim() || null);
      return;
    }
    if (kb.matches(keyData, 'selectCancel')) {
      this.onCancel?.();
      return;
    }
    this.input.handleInput(keyData);
  }

  getValue(): string {
    return this.input.getValue();
  }
}
