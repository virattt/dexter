/**
 * LangSmith Evaluation Runner for Dexter
 * 
 * Usage:
 *   bun run src/evals/run.ts                                      # Run on all questions
 *   bun run src/evals/run.ts --sample 10                          # Run on random sample
 *   bun run src/evals/run.ts --model gpt-5.6-terra                # Evaluate Terra
 *   bun run src/evals/run.ts --model gpt-5.6-luna                 # Evaluate Luna
 *   bun run src/evals/run.ts --model claude-opus-4-8              # Evaluate Opus 4.8
 *   bun run src/evals/run.ts --model claude-fable-5               # Evaluate Fable 5
 *   bun run src/evals/run.ts --model claude-opus-4-8 --judge-model gpt-5.6-luna
 */

import 'dotenv/config';
import { ProcessTerminal, TUI } from '@mariozechner/pi-tui';
import { Client } from 'langsmith';
import type { EvaluationResult } from 'langsmith/evaluation';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Agent } from '../agent/agent.js';
import { getChatModel } from '../model/llm.js';
import { getModelDisplayName } from '../utils/model.js';
import { EvalApp, type EvalProgressEvent } from './components/index.js';
import { parseEvalOptions, type EvalOptions } from './options.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
interface Example {
  inputs: { question: string };
  outputs: { answer: string };
}

// ============================================================================
// CSV Parser - handles multi-line quoted fields
// ============================================================================

function parseCSV(csvContent: string): Example[] {
  const examples: Example[] = [];
  const lines = csvContent.split('\n');
  
  let i = 1; // Skip header row
  
  while (i < lines.length) {
    const result = parseRow(lines, i);
    if (result) {
      const { row, nextIndex } = result;
      if (row.length >= 2 && row[0].trim()) {
        examples.push({
          inputs: { question: row[0] },
          outputs: { answer: row[1] }
        });
      }
      i = nextIndex;
    } else {
      i++;
    }
  }
  
  return examples;
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
          // Escaped quote
          currentField += '"';
          charIndex += 2;
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
          charIndex++;
        } else if (char === ',') {
          // End of field
          fields.push(currentField);
          currentField = '';
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      }
    }
    
    if (inQuotes) {
      // Continue to next line (multi-line field)
      currentField += '\n';
      lineIndex++;
      charIndex = 0;
    } else {
      // Row complete
      fields.push(currentField);
      return { row: fields, nextIndex: lineIndex + 1 };
    }
  }
  
  // Handle case where file ends while in quotes
  if (currentField) {
    fields.push(currentField);
  }
  return { row: fields, nextIndex: lineIndex };
}

// ============================================================================
// Sampling utilities
// ============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Target function - wraps Dexter agent
// ============================================================================

async function target(inputs: { question: string }, model: string): Promise<{ answer: string }> {
  const agent = await Agent.create({ model, maxIterations: 10 });
  let answer = '';
  
  for await (const event of agent.run(inputs.question)) {
    if (event.type === 'done') {
      answer = event.answer;
    }
  }
  
  return { answer };
}

// ============================================================================
// Correctness evaluator - LLM-as-judge
// ============================================================================

const EvaluatorOutputSchema = z.object({
  score: z.number().min(0).max(1),
  comment: z.string(),
});

function createCorrectnessEvaluator(judgeModel: string) {
  const structuredLlm = getChatModel(judgeModel).withStructuredOutput(EvaluatorOutputSchema);

  return async function correctnessEvaluator({
    outputs,
    referenceOutputs,
  }: {
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    referenceOutputs?: Record<string, unknown>;
  }): Promise<EvaluationResult> {
    const actualAnswer = (outputs?.answer as string) || '';
    const expectedAnswer = (referenceOutputs?.answer as string) || '';

    const prompt = `You are evaluating the correctness of an AI assistant's answer to a financial question.

Compare the actual answer to the expected answer. The actual answer is considered correct if it conveys the same key information as the expected answer. Minor differences in wording, formatting, or additional context are acceptable as long as the core facts are correct.

Expected Answer:
${expectedAnswer}

Actual Answer:
${actualAnswer}

Evaluate and provide:
- score: 1 if the answer is correct (contains the key information), 0 if incorrect
- comment: brief explanation of why the answer is correct or incorrect`;

    try {
      const result = await structuredLlm.invoke(prompt);
      return {
        key: 'correctness',
        score: result.score,
        comment: result.comment,
      };
    } catch (error) {
      return {
        key: 'correctness',
        score: 0,
        comment: `Evaluator error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

function slugifyModelId(modelId: string): string {
  return modelId
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'model';
}

// ============================================================================
// Evaluation generator - yields progress events for the UI
// ============================================================================

function createEvaluationRunner(options: EvalOptions) {
  return async function* runEvaluation(): AsyncGenerator<EvalProgressEvent, void, unknown> {
    const { model, judgeModel, sampleSize } = options;
    const modelDisplayName = getModelDisplayName(model);
    const judgeModelDisplayName = getModelDisplayName(judgeModel);
    const correctnessEvaluator = createCorrectnessEvaluator(judgeModel);

    // Load and parse dataset
    const csvPath = path.join(__dirname, 'dataset', 'finance_agent.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    let examples = parseCSV(csvContent);
    const totalCount = examples.length;

    // Apply sampling if requested
    if (sampleSize && sampleSize < examples.length) {
      examples = shuffleArray(examples).slice(0, sampleSize);
    }

    // Create LangSmith client
    const client = new Client();

    // Create a unique dataset name for this run (sampling creates different datasets)
    const datasetName = sampleSize 
      ? `dexter-finance-eval-sample-${sampleSize}-${Date.now()}`
      : 'dexter-finance-eval';

    // Yield init event
    yield {
      type: 'init',
      total: examples.length,
      datasetName: sampleSize ? `finance_agent (sample ${sampleSize}/${totalCount})` : 'finance_agent',
      model,
      modelDisplayName,
      judgeModel,
      judgeModelDisplayName,
    };

    // Check if dataset exists (only for full runs)
    let dataset;
    if (!sampleSize) {
      try {
        dataset = await client.readDataset({ datasetName });
      } catch {
        // Dataset doesn't exist, will create
        dataset = null;
      }
    }

    // Create dataset if needed
    if (!dataset) {
      dataset = await client.createDataset(datasetName, {
        description: sampleSize 
          ? `Finance agent evaluation (sample of ${sampleSize})`
          : 'Finance agent evaluation dataset',
      });

      // Upload examples
      await client.createExamples({
        datasetId: dataset.id,
        inputs: examples.map((e) => e.inputs),
        outputs: examples.map((e) => e.outputs),
      });
    }

    // Generate experiment name for tracking
    const experimentName = [
      'dexter-eval',
      slugifyModelId(model),
      'judge',
      slugifyModelId(judgeModel),
      Date.now().toString(36),
    ].join('-');

    // Run evaluation manually - process each example one by one
    for (const example of examples) {
      const question = example.inputs.question;

      // Yield question start - UI shows this immediately
      yield {
        type: 'question_start',
        question,
      };

      // Run the agent to get an answer
      const startTime = Date.now();
      const outputs = await target(example.inputs, model);
      const endTime = Date.now();

      // Run the correctness evaluator
      const evalResult = await correctnessEvaluator({
        inputs: example.inputs,
        outputs,
        referenceOutputs: example.outputs,
      });

      // Log to LangSmith for tracking
      await client.createRun({
        name: 'dexter-eval-run',
        run_type: 'chain',
        inputs: example.inputs,
        outputs,
        start_time: startTime,
        end_time: endTime,
        project_name: experimentName,
        extra: {
          dataset: datasetName,
          models: {
            target: {
              id: model,
              display_name: modelDisplayName,
            },
            judge: {
              id: judgeModel,
              display_name: judgeModelDisplayName,
            },
          },
          reference_outputs: example.outputs,
          evaluation: {
            score: evalResult.score,
            comment: evalResult.comment,
          },
        },
      });

      // Yield question end with result - UI updates progress bar
      yield {
        type: 'question_end',
        question,
        score: typeof evalResult.score === 'number' ? evalResult.score : 0,
        comment: evalResult.comment || '',
      };
    }

    // Yield complete event
    yield {
      type: 'complete',
      experimentName,
      model,
      modelDisplayName,
      judgeModel,
      judgeModelDisplayName,
    };
  };
}

// ============================================================================
// Main entry point
// ============================================================================

async function main() {
  const options = parseEvalOptions(process.argv.slice(2));

  const runEvaluation = createEvaluationRunner(options);

  const tui = new TUI(new ProcessTerminal());
  const evalApp = new EvalApp(tui, runEvaluation);

  tui.addChild(evalApp);
  tui.start();

  try {
    await evalApp.run();
  } finally {
    evalApp.dispose();
    tui.stop();
  }
}

main().catch(console.error);
