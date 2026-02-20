import { LongTermChatHistory } from '../utils/long-term-chat-history.js';

type ChangeListener = () => void;

export class InputHistoryController {
  private store = new LongTermChatHistory();
  private messages: string[] = [];
  private historyIndex = -1;
  private onChange?: ChangeListener;

  constructor(onChange?: ChangeListener) {
    this.onChange = onChange;
  }

  async init() {
    await this.store.load();
    this.messages = this.store.getMessageStrings();
    this.emitChange();
  }

  setOnChange(onChange?: ChangeListener) {
    this.onChange = onChange;
  }

  get historyValue(): string | null {
    return this.historyIndex === -1 ? null : (this.messages[this.historyIndex] ?? null);
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  navigateUp() {
    if (this.messages.length === 0) {
      return;
    }
    const maxIndex = this.messages.length - 1;
    if (this.historyIndex === -1) {
      this.historyIndex = 0;
    } else if (this.historyIndex < maxIndex) {
      this.historyIndex += 1;
    }
    this.emitChange();
  }

  navigateDown() {
    if (this.historyIndex === -1) {
      return;
    }
    if (this.historyIndex === 0) {
      this.historyIndex = -1;
    } else {
      this.historyIndex -= 1;
    }
    this.emitChange();
  }

  resetNavigation() {
    this.historyIndex = -1;
    this.emitChange();
  }

  async saveMessage(message: string) {
    await this.store.addUserMessage(message);
    this.messages = this.store.getMessageStrings();
    this.emitChange();
  }

  async updateAgentResponse(response: string) {
    await this.store.updateAgentResponse(response);
  }

  private emitChange() {
    this.onChange?.();
  }
}
