import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const ThoughtSchema = z.object({
  thought: z.string().describe('Your current thinking step'),
  nextThoughtNeeded: z
    .boolean()
    .describe('Whether another thought step is needed'),
  thoughtNumber: z
    .number()
    .int()
    .min(1)
    .describe('Current thought number in sequence (e.g. 1, 2, 3)'),
  totalThoughts: z
    .number()
    .int()
    .min(1)
    .describe('Estimated total thoughts needed (can be adjusted up or down as you progress)'),
  isRevision: z
    .boolean()
    .optional()
    .describe('True when this thought revises a previous one'),
  revisesThought: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('If isRevision is true, which thought number is being reconsidered'),
  branchFromThought: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Branching point thought number when exploring an alternative path'),
  branchId: z
    .string()
    .optional()
    .describe('Identifier for the current branch'),
  needsMoreThoughts: z
    .boolean()
    .optional()
    .describe('Set true when reaching the estimated end but realising more thoughts are needed'),
});

export type ThoughtData = z.infer<typeof ThoughtSchema>;

// ---------------------------------------------------------------------------
// Core engine (mirrors SequentialThinkingServer from the MCP reference impl)
// ---------------------------------------------------------------------------

export class SequentialThinkingEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

  /** Reset state — call between independent agent queries. */
  reset(): void {
    this.thoughtHistory = [];
    this.branches = {};
  }

  getHistory(): ThoughtData[] {
    return [...this.thoughtHistory];
  }

  getBranchIds(): string[] {
    return Object.keys(this.branches);
  }

  processThought(input: ThoughtData): {
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    branches: string[];
    thoughtHistoryLength: number;
  } {
    // Allow the model to self-correct its estimate on-the-fly
    if (input.thoughtNumber > input.totalThoughts) {
      input.totalThoughts = input.thoughtNumber;
    }

    this.thoughtHistory.push(input);

    if (input.branchFromThought && input.branchId) {
      if (!this.branches[input.branchId]) {
        this.branches[input.branchId] = [];
      }
      this.branches[input.branchId].push(input);
    }

    return {
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      branches: Object.keys(this.branches),
      thoughtHistoryLength: this.thoughtHistory.length,
    };
  }

  /** Format a thought for terminal display (used by the CLI renderer). */
  static formatThought(data: ThoughtData): string {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = data;

    let prefix: string;
    let context: string;

    if (isRevision) {
      prefix = chalk.yellow('🔄 Revision');
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = chalk.green('🌿 Branch');
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = chalk.blue('💭 Thought');
      context = '';
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    // Strip chalk codes for border width calculation
    const plainHeader = header.replace(/\u001b\[[0-9;]*m/g, '');
    const maxWidth = Math.max(plainHeader.length, thought.length);
    const border = '─'.repeat(maxWidth + 4);

    return [
      `┌${border}┐`,
      `│ ${plainHeader.padEnd(maxWidth + 2)} │`,
      `├${border}┤`,
      `│ ${thought.padEnd(maxWidth + 2)} │`,
      `└${border}┘`,
    ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton engine — shared across the agent session
// ---------------------------------------------------------------------------

export const sequentialThinkingEngine = new SequentialThinkingEngine();

// ---------------------------------------------------------------------------
// Tool description
// ---------------------------------------------------------------------------

export const SEQUENTIAL_THINKING_DESCRIPTION = `\
A tool for dynamic, reflective problem-solving through structured sequential thoughts.

Use this tool when:
- Breaking down a complex financial research question into steps
- Planning multi-step analysis (e.g. valuation model, competitor comparison)
- Working through a problem where the full scope is unclear initially
- Situations requiring hypothesis generation and verification
- Analysis that may need course correction mid-way

Key capabilities:
- Adjust totalThoughts up or down as you progress
- Revise earlier thoughts (set isRevision: true, revisesThought: N)
- Branch into alternative paths (set branchFromThought: N, branchId: "branch-name")
- Continue beyond the initial estimate with needsMoreThoughts: true
- Each thought builds context for the next; the final thought should provide a definitive answer

Parameters:
- thought: The current analytical step
- thoughtNumber: Position in sequence (1, 2, 3…)
- totalThoughts: Running estimate of steps needed
- nextThoughtNeeded: false only when a satisfactory conclusion is reached
- isRevision / revisesThought: For correcting earlier reasoning
- branchFromThought / branchId: For exploring alternative approaches in parallel`;

// ---------------------------------------------------------------------------
// LangChain tool
// ---------------------------------------------------------------------------

export const sequentialThinkingTool = new DynamicStructuredTool({
  name: 'sequential_thinking',
  description: SEQUENTIAL_THINKING_DESCRIPTION,
  schema: ThoughtSchema,
  func: async (input: ThoughtData): Promise<string> => {
    const result = sequentialThinkingEngine.processThought(input);

    // Print formatted thought to stderr so it appears in the CLI without
    // polluting the tool result that goes back to the LLM
    process.stderr.write(SequentialThinkingEngine.formatThought(input) + '\n');

    return JSON.stringify(result, null, 2);
  },
});
