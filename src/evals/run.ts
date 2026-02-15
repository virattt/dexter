/**
 * LangSmith Evaluation Runner for Dexter
 * 
 * Usage:
 *   bun run src/evals/run.ts                             # Run full default dataset
 *   bun run src/evals/run.ts --sample 10                 # Run random sample
 *   bun run src/evals/run.ts --dataset regression        # Run regression dataset
 *   bun run src/evals/run.ts --dataset ./path/to.csv     # Run custom CSV
 *
 * Reliability gate:
 *   Generated answers must pass deterministic reliability checks
 *   (no empty responses, tool failure text, raw tool payload leaks).
 */

import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { Client } from 'langsmith';
import type { EvaluationResult } from 'langsmith/evaluation';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Agent } from '../agent/agent.js';
import { EvalApp, type EvalProgressEvent } from './components/index.js';
import { parseCSV, runReliabilityChecks, formatReliabilityIssues } from './core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
interface DatasetConfig {
  datasetPath: string;
  datasetLabel: string;
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

async function target(inputs: { question: string }): Promise<{ answer: string }> {
  const agent = Agent.create({ model: 'gpt-5.2', maxIterations: 10 });
  let answer = '';
  
  for await (const event of agent.run(inputs.question)) {
    if (event.type === 'done') {
      answer = event.answer;
    }
  }
  
  return { answer };
}

// ============================================================================
// CLI arg helpers
// ============================================================================

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) {
    return undefined;
  }
  return args[idx + 1];
}

function parseSampleSize(args: string[]): number | undefined {
  const raw = getArgValue(args, '--sample');
  if (!raw) return undefined;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --sample value: ${raw}`);
  }
  return parsed;
}

function resolveDatasetConfig(args: string[]): DatasetConfig {
  const raw = getArgValue(args, '--dataset');
  const datasetArg = raw?.trim() || 'finance_agent';
  const datasetDir = path.join(__dirname, 'dataset');

  if (datasetArg === 'finance_agent') {
    return {
      datasetPath: path.join(datasetDir, 'finance_agent.csv'),
      datasetLabel: 'finance_agent',
    };
  }

  if (datasetArg === 'regression' || datasetArg === 'finance_agent_regression') {
    return {
      datasetPath: path.join(datasetDir, 'finance_agent_regression.csv'),
      datasetLabel: 'finance_agent_regression',
    };
  }

  const isPathLike = datasetArg.endsWith('.csv') || datasetArg.includes('/') || datasetArg.includes('\\');
  if (isPathLike) {
    const resolved = path.isAbsolute(datasetArg)
      ? datasetArg
      : path.resolve(process.cwd(), datasetArg);
    return {
      datasetPath: resolved,
      datasetLabel: path.basename(resolved, '.csv') || 'custom_dataset',
    };
  }

  throw new Error(
    `Unknown dataset "${datasetArg}". Use finance_agent, regression, or a CSV file path.`
  );
}

// ============================================================================
// Correctness evaluator - LLM-as-judge using gpt-5.2
// ============================================================================

const EvaluatorOutputSchema = z.object({
  score: z.number().min(0).max(1),
  comment: z.string(),
});

const llm = new ChatOpenAI({
  model: 'gpt-5.2',
  apiKey: process.env.OPENAI_API_KEY,
});

const structuredLlm = llm.withStructuredOutput(EvaluatorOutputSchema);

async function correctnessEvaluator({
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
}

// ============================================================================
// Evaluation generator - yields progress events for the UI
// ============================================================================

function createEvaluationRunner(sampleSize: number | undefined, dataset: DatasetConfig) {
  return async function* runEvaluation(): AsyncGenerator<EvalProgressEvent, void, unknown> {
    // Load and parse dataset
    const csvContent = fs.readFileSync(dataset.datasetPath, 'utf-8');
    let examples = parseCSV(csvContent);

    if (examples.length === 0) {
      throw new Error(`Dataset has no examples: ${dataset.datasetPath}`);
    }

    const totalCount = examples.length;

    // Apply sampling if requested
    if (sampleSize && sampleSize < examples.length) {
      examples = shuffleArray(examples).slice(0, sampleSize);
    }

    // Create LangSmith client
    const client = new Client();

    // Create a unique dataset name for this run (sampling creates different datasets)
    const datasetName = sampleSize 
      ? `dexter-${dataset.datasetLabel}-sample-${sampleSize}-${Date.now()}`
      : `dexter-${dataset.datasetLabel}`;

    // Yield init event
    yield {
      type: 'init',
      total: examples.length,
      datasetName: sampleSize
        ? `${dataset.datasetLabel} (sample ${sampleSize}/${totalCount})`
        : dataset.datasetLabel,
    };

    // Check if dataset exists (only for full runs)
    let langsmithDataset;
    if (!sampleSize) {
      try {
        langsmithDataset = await client.readDataset({ datasetName });
      } catch {
        // Dataset doesn't exist, will create
        langsmithDataset = null;
      }
    }

    // Create dataset if needed
    if (!langsmithDataset) {
      langsmithDataset = await client.createDataset(datasetName, {
        description: sampleSize 
          ? `Finance agent evaluation (sample of ${sampleSize})`
          : 'Finance agent evaluation dataset',
      });

      // Upload examples
      await client.createExamples({
        datasetId: langsmithDataset.id,
        inputs: examples.map((e) => e.inputs),
        outputs: examples.map((e) => e.outputs),
      });
    }

    // Generate experiment name for tracking
    const experimentName = `dexter-eval-${Date.now().toString(36)}`;

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
      const outputs = await target(example.inputs);
      const endTime = Date.now();

      // Run reliability checks first; skip judge call on obvious failures
      const reliability = runReliabilityChecks(outputs.answer);

      let evalResult: EvaluationResult;
      if (!reliability.passed) {
        evalResult = {
          key: 'correctness',
          score: 0,
          comment: `Reliability check failed. ${formatReliabilityIssues(reliability.issues)}`,
        };
      } else {
        // Run the correctness evaluator
        evalResult = await correctnessEvaluator({
          inputs: example.inputs,
          outputs,
          referenceOutputs: example.outputs,
        });
      }

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
          reference_outputs: example.outputs,
          evaluation: {
            score: evalResult.score,
            comment: evalResult.comment,
            reliability: {
              passed: reliability.passed,
              issues: reliability.issues,
            },
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
    };
  };
}

// ============================================================================
// Main entry point
// ============================================================================

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sampleSize = parseSampleSize(args);
  const dataset = resolveDatasetConfig(args);

  // Create the evaluation runner with selected options
  const runEvaluation = createEvaluationRunner(sampleSize, dataset);

  // Render the Ink UI
  const { waitUntilExit } = render(
    React.createElement(EvalApp, { runEvaluation })
  );
  
  await waitUntilExit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
