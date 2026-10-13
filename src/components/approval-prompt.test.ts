import { describe, expect, test } from 'bun:test';
import { ApprovalPromptComponent } from './approval-prompt.js';
import { evaluateBash } from '../permissions/engine.js';
import type { RuleSet } from '../permissions/rules.js';

const NO_RULES: RuleSet = { allow: [], ask: [], deny: [], defaultBashDecision: 'ask' };

/** The option labels the approval prompt renders, without colors or the cursor. */
function optionLabels(prompt: ApprovalPromptComponent): string[] {
  return prompt.selector
    .render(120)
    .map((line: string) => line.replace(/\u001b\[[0-9;]*m/g, '').replace('→', '').trim())
    .filter(Boolean);
}

describe('ApprovalPromptComponent options', () => {
  test.each(['write_file', 'edit_file'])('%s prompt offers to always allow edits', (tool) => {
    const prompt = new ApprovalPromptComponent(tool, { path: 'notes.md' });
    expect(optionLabels(prompt)).toEqual([
      '1. Yes',
      '2. Yes, allow all edits this session',
      '3. Yes, always allow edits',
      '4. No',
    ]);
  });

  // Compound and unparseable commands get no proposed rule, so "always" could not be saved.
  test.each(['ls && pwd', 'echo $(whoami)'])('bash prompt for %p has no always option', (command) => {
    const { proposedRule } = evaluateBash(command, NO_RULES);
    const prompt = new ApprovalPromptComponent('bash', { command }, { command, proposedRule });
    const labels = optionLabels(prompt);
    expect(labels.filter((label) => label.includes('always'))).toEqual([]);
    expect(labels.at(-1)).toBe('3. No');
  });
});
