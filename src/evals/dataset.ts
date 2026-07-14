import { createHash } from 'node:crypto';
import fs from 'node:fs';

export type RubricOperator = 'correctness' | 'contradiction';

export interface RubricCriterion {
  id: string;
  operator: RubricOperator;
  criteria: string;
}

export interface EvalExample {
  id: string;
  inputs: { question: string };
  outputs: { answer: string };
  questionType: string;
  expertTimeMinutes: number;
  rubric: RubricCriterion[];
}

export interface EvalDataset {
  examples: EvalExample[];
  hash: string;
}

function parseRow(lines: string[], startIndex: number): { row: string[]; nextIndex: number } | null {
  if (startIndex >= lines.length || !lines[startIndex].trim()) {
    return null;
  }

  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let lineIndex = startIndex;
  let charIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    while (charIndex < line.length) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          charIndex += 2;
        } else if (char === '"') {
          inQuotes = false;
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      } else if (char === '"') {
        inQuotes = true;
        charIndex++;
      } else if (char === ',') {
        fields.push(currentField);
        currentField = '';
        charIndex++;
      } else {
        currentField += char;
        charIndex++;
      }
    }

    if (inQuotes) {
      currentField += '\n';
      lineIndex++;
      charIndex = 0;
    } else {
      fields.push(currentField);
      return { row: fields, nextIndex: lineIndex + 1 };
    }
  }

  if (currentField) {
    fields.push(currentField);
  }
  return { row: fields, nextIndex: lineIndex };
}

export function parseCSVRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  const lines = csvContent.split('\n');
  let i = 0;

  while (i < lines.length) {
    const result = parseRow(lines, i);
    if (result) {
      rows.push(result.row);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  return rows;
}

function parseRubric(rawRubric: string, rowNumber: number): RubricCriterion[] {
  const normalized = rawRubric
    .replace(/([{,]\s*)'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g, '$1"$2":')
    .replace(/:\s*'((?:\\'|[^'])*)'/g, (_, value: string) => {
      const unescaped = value.replace(/\\'/g, "'");
      return `:${JSON.stringify(unescaped)}`;
    });

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    throw new Error(
      `Invalid rubric JSON on row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid rubric on row ${rowNumber}: expected an array`);
  }

  const criteria = parsed.map((entry, index): RubricCriterion => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid rubric entry ${index + 1} on row ${rowNumber}: expected object`);
    }

    const record = entry as Record<string, unknown>;
    const operator = record.operator;
    const criteriaText = record.criteria;

    if (operator !== 'correctness' && operator !== 'contradiction') {
      throw new Error(`Invalid rubric operator on row ${rowNumber}: ${String(operator)}`);
    }

    if (typeof criteriaText !== 'string' || criteriaText.trim().length === 0) {
      throw new Error(`Invalid rubric criteria on row ${rowNumber}: expected non-empty string`);
    }

    return {
      id: `c${index + 1}`,
      operator,
      criteria: criteriaText.trim(),
    };
  });

  if (!criteria.some((criterion) => criterion.operator === 'correctness')) {
    throw new Error(`Invalid rubric on row ${rowNumber}: missing correctness criteria`);
  }

  return criteria;
}

export function parseEvalDataset(csvContent: string): EvalDataset {
  const rows = parseCSVRows(csvContent);
  const examples: EvalExample[] = [];

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    if (!row?.[0]?.trim()) {
      continue;
    }

    if (row.length < 5) {
      throw new Error(`Invalid eval dataset row ${index + 1}: expected 5 columns`);
    }

    const expertTimeMinutes = Number(row[3]);
    if (!Number.isFinite(expertTimeMinutes) || expertTimeMinutes < 0) {
      throw new Error(`Invalid expert time on row ${index + 1}: ${row[3]}`);
    }

    examples.push({
      id: `q${examples.length + 1}`,
      inputs: { question: row[0].trim() },
      outputs: { answer: row[1].trim() },
      questionType: row[2].trim(),
      expertTimeMinutes,
      rubric: parseRubric(row[4], index + 1),
    });
  }

  const normalized = examples.map((example) => ({
    question: example.inputs.question,
    answer: example.outputs.answer,
    questionType: example.questionType,
    expertTimeMinutes: example.expertTimeMinutes,
    rubric: example.rubric.map(({ operator, criteria }) => ({ operator, criteria })),
  }));

  return {
    examples,
    hash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 12),
  };
}

export function loadEvalDataset(csvPath: string): EvalDataset {
  return parseEvalDataset(fs.readFileSync(csvPath, 'utf-8'));
}
