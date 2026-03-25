import { describe, test, expect, beforeEach } from 'bun:test';
import {
  SequentialThinkingEngine,
  sequentialThinkingTool,
  ThoughtSchema,
  type ThoughtData,
} from './sequential.js';

// ---------------------------------------------------------------------------
// SequentialThinkingEngine unit tests
// ---------------------------------------------------------------------------

describe('SequentialThinkingEngine', () => {
  let engine: SequentialThinkingEngine;

  beforeEach(() => {
    engine = new SequentialThinkingEngine();
  });

  test('records first thought and returns correct metadata', () => {
    const thought: ThoughtData = {
      thought: 'Step 1: identify key metrics',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    };

    const result = engine.processThought(thought);

    expect(result.thoughtNumber).toBe(1);
    expect(result.totalThoughts).toBe(3);
    expect(result.nextThoughtNeeded).toBe(true);
    expect(result.thoughtHistoryLength).toBe(1);
    expect(result.branches).toEqual([]);
  });

  test('accumulates multiple thoughts in history', () => {
    engine.processThought({ thought: 'Step 1', thoughtNumber: 1, totalThoughts: 2, nextThoughtNeeded: true });
    const result = engine.processThought({ thought: 'Step 2', thoughtNumber: 2, totalThoughts: 2, nextThoughtNeeded: false });

    expect(result.thoughtHistoryLength).toBe(2);
    expect(result.nextThoughtNeeded).toBe(false);
  });

  test('auto-corrects totalThoughts when thoughtNumber exceeds it', () => {
    const result = engine.processThought({
      thought: 'Unexpected extra thought',
      thoughtNumber: 5,
      totalThoughts: 3,
      nextThoughtNeeded: false,
    });

    expect(result.totalThoughts).toBe(5);
  });

  test('tracks branches by branchId', () => {
    engine.processThought({ thought: 'Main path', thoughtNumber: 1, totalThoughts: 4, nextThoughtNeeded: true });
    const result = engine.processThought({
      thought: 'Branch A exploration',
      thoughtNumber: 2,
      totalThoughts: 4,
      nextThoughtNeeded: true,
      branchFromThought: 1,
      branchId: 'branch-A',
    });

    expect(result.branches).toContain('branch-A');
  });

  test('supports multiple distinct branches', () => {
    engine.processThought({ thought: 'Root', thoughtNumber: 1, totalThoughts: 6, nextThoughtNeeded: true });
    engine.processThought({ thought: 'Branch A', thoughtNumber: 2, totalThoughts: 6, nextThoughtNeeded: true, branchFromThought: 1, branchId: 'alpha' });
    const result = engine.processThought({ thought: 'Branch B', thoughtNumber: 3, totalThoughts: 6, nextThoughtNeeded: true, branchFromThought: 1, branchId: 'beta' });

    expect(result.branches).toContain('alpha');
    expect(result.branches).toContain('beta');
  });

  test('flags revisions correctly in history', () => {
    engine.processThought({ thought: 'Wrong assumption', thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true });
    const result = engine.processThought({
      thought: 'Corrected assumption',
      thoughtNumber: 2,
      totalThoughts: 3,
      nextThoughtNeeded: true,
      isRevision: true,
      revisesThought: 1,
    });

    expect(result.thoughtHistoryLength).toBe(2);
    const history = engine.getHistory();
    expect(history[1].isRevision).toBe(true);
    expect(history[1].revisesThought).toBe(1);
  });

  test('reset clears history and branches', () => {
    engine.processThought({ thought: 'Thought A', thoughtNumber: 1, totalThoughts: 2, nextThoughtNeeded: true });
    engine.processThought({ thought: 'Branch', thoughtNumber: 2, totalThoughts: 2, nextThoughtNeeded: false, branchFromThought: 1, branchId: 'x' });

    engine.reset();

    expect(engine.getHistory()).toHaveLength(0);
    expect(engine.getBranchIds()).toHaveLength(0);
  });

  test('getHistory returns a copy (not the live array)', () => {
    engine.processThought({ thought: 'Step 1', thoughtNumber: 1, totalThoughts: 1, nextThoughtNeeded: false });
    const h1 = engine.getHistory();
    engine.processThought({ thought: 'Step 2', thoughtNumber: 2, totalThoughts: 2, nextThoughtNeeded: false });

    expect(h1).toHaveLength(1); // snapshot before second thought
  });
});

// ---------------------------------------------------------------------------
// formatThought rendering tests
// ---------------------------------------------------------------------------

describe('SequentialThinkingEngine.formatThought', () => {
  test('renders normal thought with 💭 prefix', () => {
    const out = SequentialThinkingEngine.formatThought({
      thought: 'Analyse revenue trend',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    });

    expect(out).toContain('💭');
    expect(out).toContain('1/3');
    expect(out).toContain('Analyse revenue trend');
  });

  test('renders revision with 🔄 prefix', () => {
    const out = SequentialThinkingEngine.formatThought({
      thought: 'Revised: use EV/EBITDA instead',
      thoughtNumber: 2,
      totalThoughts: 3,
      nextThoughtNeeded: true,
      isRevision: true,
      revisesThought: 1,
    });

    expect(out).toContain('🔄');
    expect(out).toContain('revising thought 1');
  });

  test('renders branch with 🌿 prefix', () => {
    const out = SequentialThinkingEngine.formatThought({
      thought: 'Bear-case scenario',
      thoughtNumber: 3,
      totalThoughts: 5,
      nextThoughtNeeded: true,
      branchFromThought: 2,
      branchId: 'bear-case',
    });

    expect(out).toContain('🌿');
    expect(out).toContain('bear-case');
  });

  test('output contains box-drawing characters', () => {
    const out = SequentialThinkingEngine.formatThought({
      thought: 'Test',
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    });

    expect(out).toContain('┌');
    expect(out).toContain('└');
    expect(out).toContain('│');
  });
});

// ---------------------------------------------------------------------------
// ThoughtSchema validation
// ---------------------------------------------------------------------------

describe('ThoughtSchema', () => {
  test('accepts minimal valid input', () => {
    const result = ThoughtSchema.safeParse({
      thought: 'Initial analysis',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    });
    expect(result.success).toBe(true);
  });

  test('accepts full input with all optional fields', () => {
    const result = ThoughtSchema.safeParse({
      thought: 'Branch thought',
      thoughtNumber: 2,
      totalThoughts: 4,
      nextThoughtNeeded: true,
      isRevision: false,
      branchFromThought: 1,
      branchId: 'alternative',
      needsMoreThoughts: false,
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing required fields', () => {
    const result = ThoughtSchema.safeParse({ thought: 'Incomplete' });
    expect(result.success).toBe(false);
  });

  test('rejects non-positive thoughtNumber', () => {
    const result = ThoughtSchema.safeParse({
      thought: 'Bad',
      thoughtNumber: 0,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DynamicStructuredTool integration test
// ---------------------------------------------------------------------------

describe('sequentialThinkingTool', () => {
  test('tool name is sequential_thinking', () => {
    expect(sequentialThinkingTool.name).toBe('sequential_thinking');
  });

  test('tool returns valid JSON with expected keys', async () => {
    const raw = await sequentialThinkingTool.invoke({
      thought: 'Evaluate P/E ratio',
      thoughtNumber: 1,
      totalThoughts: 2,
      nextThoughtNeeded: true,
    });

    const parsed = JSON.parse(raw as string);
    expect(typeof parsed.thoughtNumber).toBe('number');
    expect(typeof parsed.totalThoughts).toBe('number');
    expect(typeof parsed.nextThoughtNeeded).toBe('boolean');
    expect(Array.isArray(parsed.branches)).toBe(true);
    expect(typeof parsed.thoughtHistoryLength).toBe('number');
  });

  test('tool reports nextThoughtNeeded false at final step', async () => {
    const raw = await sequentialThinkingTool.invoke({
      thought: 'Final conclusion: BUY',
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    });

    const parsed = JSON.parse(raw as string);
    expect(parsed.nextThoughtNeeded).toBe(false);
  });
});
