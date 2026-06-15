import { Container, Key, matchesKey, truncateToWidth, type TUI } from '@mariozechner/pi-tui';
import { CustomEditor } from './custom-editor.js';
import { editorTheme, theme } from '../theme.js';
import type { Question, QuestionAnswer, UserAnswers } from '../tools/ask-user-question/types.js';

/** Marker stored in a multi-select question's set when "Other" is chosen. */
const OTHER_MARKER = 'Other';

type Mode = 'select' | 'other';

/**
 * Interactive inline widget for the ask_user_question tool.
 *
 * Renders as a tab strip (one tab per question plus a Submit tab) over a numbered
 * option list with a `❯` cursor. The component owns all keyboard input — pi-tui
 * routes keys to a single focused component — and drives a `CustomEditor` for the
 * "Other" free-text choice via a small mode machine.
 *
 * Row layout per question tab (cursor flows through all of them):
 *   options[0..m-1] · "Type something." (Other) · "Chat about this" (decline)
 */
export class QuestionPromptComponent extends Container {
  onSubmit?: (answers: UserAnswers) => void;
  onCancel?: () => void;
  onAbort?: () => void;

  private readonly tui: TUI;
  private readonly questions: Question[];
  /** Index of the Submit tab (one past the last question). */
  private readonly submitTab: number;
  private readonly selected: Set<string>[];
  private readonly otherText: (string | undefined)[];
  private readonly cursors: number[];
  private activeTab = 0;
  private mode: Mode = 'select';
  private editor: CustomEditor | null = null;

  constructor(questions: Question[], tui: TUI) {
    super();
    this.tui = tui;
    this.questions = questions;
    this.submitTab = questions.length;
    this.selected = questions.map(() => new Set<string>());
    this.otherText = questions.map(() => undefined);
    this.cursors = questions.map(() => 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Input
  // ──────────────────────────────────────────────────────────────────────────

  handleInput(data: string): void {
    if (this.mode === 'other') {
      this.editor?.handleInput(data);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.ctrl('c'))) {
      this.onAbort?.();
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return;
    }

    // Tab navigation (wraps across questions + Submit).
    if (matchesKey(data, Key.right) || matchesKey(data, Key.tab)) {
      this.activeTab = (this.activeTab + 1) % (this.submitTab + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.left) || matchesKey(data, 'shift+tab')) {
      this.activeTab = (this.activeTab - 1 + this.submitTab + 1) % (this.submitTab + 1);
      this.tui.requestRender();
      return;
    }

    if (this.activeTab === this.submitTab) {
      if (matchesKey(data, Key.enter)) {
        this.trySubmit();
        this.tui.requestRender();
      }
      return;
    }

    // Question tab — move the option cursor / act on a row.
    const rowCount = this.rowCount(this.activeTab);
    if (matchesKey(data, Key.up) || data === 'k') {
      this.cursors[this.activeTab] = (this.cursors[this.activeTab] - 1 + rowCount) % rowCount;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.down) || data === 'j') {
      this.cursors[this.activeTab] = (this.cursors[this.activeTab] + 1) % rowCount;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.activateRow(this.cursors[this.activeTab]);
      this.tui.requestRender();
      return;
    }
    if (
      this.questions[this.activeTab].multiSelect &&
      (data === ' ' || matchesKey(data, Key.space))
    ) {
      const idx = this.cursors[this.activeTab];
      if (idx < this.questions[this.activeTab].options.length) {
        this.toggleOption(idx);
        this.tui.requestRender();
      }
      return;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Row model: 0..m-1 options, m = Other, m+1 = Chat about this
  // ──────────────────────────────────────────────────────────────────────────

  private rowCount(tab: number): number {
    return this.questions[tab].options.length + 2;
  }

  private activateRow(idx: number): void {
    const q = this.questions[this.activeTab];
    const m = q.options.length;
    if (idx < m) {
      if (q.multiSelect) {
        this.toggleOption(idx);
      } else {
        this.selected[this.activeTab] = new Set([q.options[idx].label]);
        this.otherText[this.activeTab] = undefined;
        this.advance();
      }
    } else if (idx === m) {
      this.openOther();
    } else {
      this.onCancel?.();
    }
  }

  private toggleOption(idx: number): void {
    const label = this.questions[this.activeTab].options[idx].label;
    const set = this.selected[this.activeTab];
    if (set.has(label)) {
      set.delete(label);
    } else {
      set.add(label);
    }
  }

  /** After a single-select answer, jump to the next unanswered tab, or Submit. */
  private advance(): void {
    if (this.allAnswered()) {
      this.activeTab = this.submitTab;
      return;
    }
    const n = this.questions.length;
    for (let k = 1; k <= n; k++) {
      const idx = (this.activeTab + k) % n;
      if (!this.isAnswered(idx)) {
        this.activeTab = idx;
        return;
      }
    }
  }

  private trySubmit(): void {
    if (this.allAnswered()) {
      this.onSubmit?.({ answers: this.buildAnswers() });
      return;
    }
    for (let i = 0; i < this.questions.length; i++) {
      if (!this.isAnswered(i)) {
        this.activeTab = i;
        return;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Other free-text sub-mode
  // ──────────────────────────────────────────────────────────────────────────

  private openOther(): void {
    const tab = this.activeTab;
    const q = this.questions[tab];
    const editor = new CustomEditor(this.tui, editorTheme);
    editor.focused = true;
    if (this.otherText[tab]) {
      editor.setText(this.otherText[tab]!);
    }
    editor.onCtrlC = () => this.onAbort?.();
    editor.onEscape = () => {
      this.mode = 'select';
      this.editor = null;
      this.tui.requestRender();
    };
    editor.onSubmit = (text: string) => {
      const t = text.trim();
      if (q.multiSelect) {
        if (t) {
          this.otherText[tab] = t;
          this.selected[tab].add(OTHER_MARKER);
        } else {
          this.otherText[tab] = undefined;
          this.selected[tab].delete(OTHER_MARKER);
        }
        this.mode = 'select';
        this.editor = null;
        this.tui.requestRender();
      } else if (t) {
        this.otherText[tab] = t;
        this.selected[tab] = new Set();
        this.mode = 'select';
        this.editor = null;
        this.advance();
        this.tui.requestRender();
      } else {
        this.mode = 'select';
        this.editor = null;
        this.tui.requestRender();
      }
    };
    this.editor = editor;
    this.mode = 'other';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Derived state
  // ──────────────────────────────────────────────────────────────────────────

  private isAnswered(i: number): boolean {
    return this.selected[i].size > 0 || !!(this.otherText[i] && this.otherText[i]!.length > 0);
  }

  private allAnswered(): boolean {
    return this.questions.every((_, i) => this.isAnswered(i));
  }

  private answerText(i: number): string {
    const picks = Array.from(this.selected[i]).filter((s) => s !== OTHER_MARKER);
    if (this.otherText[i]) {
      picks.push(this.otherText[i]!);
    }
    return picks.join(', ');
  }

  private buildAnswers(): QuestionAnswer[] {
    return this.questions.map((q, i) => ({
      header: q.header,
      question: q.question,
      selected: Array.from(this.selected[i]).filter((s) => s !== OTHER_MARKER),
      otherText: this.otherText[i] || undefined,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  invalidate(): void {
    this.editor?.invalidate();
  }

  render(width: number): string[] {
    const w = Math.max(width, 1);
    const rule = theme.muted('─'.repeat(w));
    const lines: string[] = [];

    lines.push(rule);
    lines.push(this.renderTabStrip());
    lines.push('');

    if (this.activeTab === this.submitTab) {
      lines.push(...this.renderSubmit());
    } else if (this.mode === 'other') {
      lines.push(...this.renderOther(w));
    } else {
      lines.push(...this.renderQuestion(w, rule));
    }

    // pi-tui requires every rendered line to fit the live viewport width.
    // Clip ANSI-safely (preserves color/escape sequences) — scales to any terminal.
    return lines.map((line) => truncateToWidth(line, w, '…'));
  }

  private renderTabStrip(): string {
    const segs: string[] = [theme.muted('←')];
    for (let i = 0; i < this.questions.length; i++) {
      const box = this.isAnswered(i) ? '☑' : '☐';
      const seg = `${box} ${this.questions[i].header}`;
      segs.push(i === this.activeTab ? theme.primary(theme.bold(seg)) : theme.muted(seg));
    }
    const submitSeg = '✔ Submit';
    segs.push(
      this.activeTab === this.submitTab ? theme.primary(theme.bold(submitSeg)) : theme.muted(submitSeg),
    );
    segs.push(theme.muted('→'));
    return segs.join('  ');
  }

  private renderQuestion(width: number, rule: string): string[] {
    const q = this.questions[this.activeTab];
    const cursor = this.cursors[this.activeTab];
    const lines: string[] = [];
    lines.push(theme.bold(q.question));
    lines.push('');

    q.options.forEach((opt, idx) => {
      lines.push(...this.renderRow(idx, cursor, this.optionLabel(idx)));
      lines.push(`     ${theme.muted(opt.description)}`);
    });

    // Other row
    const m = q.options.length;
    const otherSuffix = this.otherText[this.activeTab] ? ` (${this.otherText[this.activeTab]})` : '';
    lines.push(...this.renderRow(m, cursor, `Type something.${otherSuffix}`));

    lines.push(rule);

    // Chat about this row (below the rule)
    lines.push(...this.renderRow(m + 1, cursor, 'Chat about this'));
    lines.push('');
    lines.push(theme.muted(this.footerHint()));
    return lines;
  }

  private optionLabel(idx: number): string {
    const q = this.questions[this.activeTab];
    if (!q.multiSelect) {
      return q.options[idx].label;
    }
    const checked = this.selected[this.activeTab].has(q.options[idx].label);
    return `${checked ? '◉' : '◯'} ${q.options[idx].label}`;
  }

  private renderRow(idx: number, cursor: number, label: string): string[] {
    const isCursor = idx === cursor;
    const arrow = isCursor ? theme.primary('❯') : ' ';
    const head = `${arrow} ${idx + 1}. ${label}`;
    return [isCursor ? theme.bold(head) : head];
  }

  private renderOther(width: number): string[] {
    const q = this.questions[this.activeTab];
    const lines: string[] = [];
    lines.push(theme.bold(q.question));
    lines.push('');
    lines.push(theme.muted('Type your answer:'));
    lines.push(...(this.editor?.render(width) ?? []));
    lines.push('');
    lines.push(theme.muted('Enter save · Esc back'));
    return lines;
  }

  private renderSubmit(): string[] {
    const lines: string[] = [];
    lines.push(theme.bold('Review your answers:'));
    lines.push('');
    this.questions.forEach((q, i) => {
      const answer = this.isAnswered(i) ? this.answerText(i) : theme.dim('— not answered');
      lines.push(`  ${theme.muted(q.header)}: ${answer}`);
    });
    lines.push('');
    const hint = this.allAnswered()
      ? 'Enter to submit · Tab/Arrow keys to navigate · Esc to cancel'
      : 'Answer all questions to submit · Tab/Arrow keys to navigate · Esc to cancel';
    lines.push(theme.muted(hint));
    return lines;
  }

  private footerHint(): string {
    const verb = this.questions[this.activeTab].multiSelect ? 'Enter/Space to toggle' : 'Enter to select';
    return `${verb} · Tab/Arrow keys to navigate · Esc to cancel`;
  }
}
