/**
 * LangSmith Evaluation Runner for Dexter
 * 
 * Usage:
 *   bun run src/evals/run.ts              # Run on all questions
 *   bun run src/evals/run.ts --sample 10  # Run on random sample of 10 questions
 */

import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { Client } from 'langsmith';
import { evaluate, type EvaluationResult } from 'langsmith/evaluation';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Agent } from '../agent/agent.js';
import { EvalApp, type EvalProgressEvent } from './components/index.js';

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

function createEvaluationRunner(sampleSize?: number) {
  return async function* runEvaluation(): AsyncGenerator<EvalProgressEvent, void, unknown> {
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

    // Run evaluation
    const experimentResults = await evaluate(target, {
      data: datasetName,
      evaluators: [correctnessEvaluator],
      experimentPrefix: 'dexter-eval',
      maxConcurrency: 2,
      client,
    });

    // Track which questions we've started (for showing current question)
    const questionMap = new Map<string, string>();
    for (const example of examples) {
      questionMap.set(example.inputs.question, example.inputs.question);
    }

    // Process results as they come in
    for await (const result of experimentResults) {
      const question = (result.example?.inputs?.question as string) || 'Unknown';
      const evalResult = result.evaluationResults?.results?.[0];
      
      // Yield question start (we don't have a real "start" event, so we yield it with the end)
      yield {
        type: 'question_start',
        question,
      };

      // Small delay to show the question briefly before showing result
      await new Promise(resolve => setTimeout(resolve, 100));

      // Yield question end with result
      yield {
        type: 'question_end',
        question,
        score: (evalResult?.score as number) ?? 0,
        comment: (evalResult?.comment as string) || '',
      };
    }

    // Yield complete event
    yield {
      type: 'complete',
      experimentName: experimentResults.experimentName,
    };
  };
}

// ============================================================================
// Main entry point
// ============================================================================

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sampleIndex = args.indexOf('--sample');
  const sampleSize = sampleIndex !== -1 ? parseInt(args[sampleIndex + 1]) : undefined;

  // Create the evaluation runner with the sample size
  const runEvaluation = createEvaluationRunner(sampleSize);

  // Render the Ink UI
  const { waitUntilExit } = render(
    React.createElement(EvalApp, { runEvaluation })
  );
  
  await waitUntilExit();
}

main().catch(console.error);
