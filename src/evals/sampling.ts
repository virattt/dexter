import type { EvalExample } from './dataset.js';

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 2 ** 32;
  };
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = createSeededRandom(seed);
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function groupByQuestionType(examples: EvalExample[]): Map<string, EvalExample[]> {
  const groups = new Map<string, EvalExample[]>();
  for (const example of examples) {
    const group = groups.get(example.questionType) ?? [];
    group.push(example);
    groups.set(example.questionType, group);
  }
  return groups;
}

function sortByDatasetOrder(examples: EvalExample[], allExamples: EvalExample[]): EvalExample[] {
  const indexById = new Map(allExamples.map((example, index) => [example.id, index]));
  return [...examples].sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0));
}

export function selectQuickExamples(examples: EvalExample[]): EvalExample[] {
  const groups = groupByQuestionType(examples);
  const selected: EvalExample[] = [];

  for (const questionType of [...groups.keys()].sort()) {
    const group = groups.get(questionType);
    if (group?.[0]) {
      selected.push(group[0]);
    }
  }

  return sortByDatasetOrder(selected, examples);
}

export function selectStratifiedSample(
  examples: EvalExample[],
  sampleSize: number,
  seed: string,
): EvalExample[] {
  if (sampleSize >= examples.length) {
    return examples;
  }

  const groups = [...groupByQuestionType(examples).entries()].sort(([a], [b]) => a.localeCompare(b));
  const selected = new Map<string, EvalExample>();
  const shuffledByType = groups.map(([questionType, group]) => ({
    questionType,
    examples: shuffleWithSeed(group, `${seed}:${questionType}`),
  }));

  for (const group of shuffledByType) {
    if (selected.size >= sampleSize) {
      break;
    }
    const example = group.examples.shift();
    if (example) {
      selected.set(example.id, example);
    }
  }

  const remaining = shuffleWithSeed(
    shuffledByType.flatMap((group) => group.examples),
    `${seed}:remaining`,
  );

  for (const example of remaining) {
    if (selected.size >= sampleSize) {
      break;
    }
    selected.set(example.id, example);
  }

  return sortByDatasetOrder([...selected.values()], examples);
}

export function selectEvalExamples(examples: EvalExample[], options: {
  quick: boolean;
  sampleSize?: number;
  seed: string;
}): EvalExample[] {
  if (options.quick) {
    return selectQuickExamples(examples);
  }

  if (options.sampleSize !== undefined) {
    return selectStratifiedSample(examples, options.sampleSize, options.seed);
  }

  return examples;
}
