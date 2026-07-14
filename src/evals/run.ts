/**
 * LangSmith Evaluation Runner for Dexter
 *
 * Usage:
 *   bun run src/evals/run.ts                                      # Run on all questions
 *   bun run src/evals/run.ts --quick                              # Run fixed stratified smoke suite
 *   bun run src/evals/run.ts --sample 10 --seed model-check       # Run seeded stratified sample
 *   bun run src/evals/run.ts --model gpt-5.6-terra                # Evaluate Terra
 *   bun run src/evals/run.ts --model claude-opus-4-8 --judge-model gpt-5.6-luna
 */

import 'dotenv/config';
import { ProcessTerminal, TUI } from '@mariozechner/pi-tui';
import { Client } from 'langsmith';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '../agent/agent.js';
import type { DoneEvent } from '../agent/types.js';
import { getModelDisplayName } from '../utils/model.js';
import { EvalApp, type EvalProgressEvent } from './components/index.js';
import { loadEvalDataset, type EvalExample } from './dataset.js';
import {
  createRubricEvaluator,
  type RubricEvaluationResult,
} from './evaluator.js';
import { parseEvalOptions, type EvalOptions } from './options.js';
import { selectEvalExamples } from './sampling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type FailureType = 'agent_error' | 'timeout' | 'judge_error';

interface TargetResult {
  answer: string;
  iterations: number;
  totalTimeMs: number;
  toolCallCount: number;
  toolCalls: DoneEvent['toolCalls'];
  failureType?: FailureType;
  failureMessage?: string;
}

export interface EvalQuestionResult {
  index: number;
  id: string;
  question: string;
  questionType: string;
  score: number | null;
  exactPass: boolean;
  comment: string;
  answer: string;
  failureType?: FailureType;
  failureMessage?: string;
  trackingError?: string;
  contradictionDetected: boolean;
  passedCriteria: number;
  totalCriteria: number;
  criteria: RubricEvaluationResult['criteria'];
  latencyMs: number;
  agentLatencyMs: number;
  judgeLatencyMs: number;
  iterations: number;
  toolCallCount: number;
}

function slugifyModelId(modelId: string): string {
  return modelId
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'model';
}

function classifyAgentAnswer(answer: string): Pick<TargetResult, 'failureType' | 'failureMessage'> {
  if (answer.startsWith('Reached maximum iterations')) {
    return {
      failureType: 'agent_error',
      failureMessage: answer,
    };
  }

  if (answer.startsWith('Error:')) {
    return {
      failureType: 'agent_error',
      failureMessage: answer,
    };
  }

  return {};
}

async function target(
  example: EvalExample,
  options: EvalOptions,
): Promise<TargetResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const start = Date.now();

  try {
    const agent = await Agent.create({
      model: options.model,
      maxIterations: 10,
      memoryEnabled: false,
      channel: 'eval',
      signal: controller.signal,
    });
    let doneEvent: DoneEvent | null = null;

    for await (const event of agent.run(example.inputs.question)) {
      if (event.type === 'done') {
        doneEvent = event;
      }
    }

    if (!doneEvent) {
      return {
        answer: '',
        iterations: 0,
        totalTimeMs: Date.now() - start,
        toolCallCount: 0,
        toolCalls: [],
        failureType: 'agent_error',
        failureMessage: 'Agent did not produce a final answer.',
      };
    }

    const classified = classifyAgentAnswer(doneEvent.answer);
    return {
      answer: doneEvent.answer,
      iterations: doneEvent.iterations,
      totalTimeMs: doneEvent.totalTime,
      toolCallCount: doneEvent.toolCalls.length,
      toolCalls: doneEvent.toolCalls,
      ...classified,
    };
  } catch (error) {
    const isTimeout = controller.signal.aborted;
    return {
      answer: '',
      iterations: 0,
      totalTimeMs: Date.now() - start,
      toolCallCount: 0,
      toolCalls: [],
      failureType: isTimeout ? 'timeout' : 'agent_error',
      failureMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function evaluateExample(
  example: EvalExample,
  index: number,
  options: EvalOptions,
  evaluateRubric: ReturnType<typeof createRubricEvaluator>,
): Promise<EvalQuestionResult> {
  const start = Date.now();
  const targetResult = await target(example, options);
  const agentLatencyMs = Date.now() - start;

  if (targetResult.failureType) {
    return {
      index,
      id: example.id,
      question: example.inputs.question,
      questionType: example.questionType,
      score: null,
      exactPass: false,
      comment: targetResult.failureMessage ?? targetResult.failureType,
      answer: targetResult.answer,
      failureType: targetResult.failureType,
      failureMessage: targetResult.failureMessage,
      contradictionDetected: false,
      passedCriteria: 0,
      totalCriteria: example.rubric.filter((criterion) => criterion.operator === 'correctness').length,
      criteria: [],
      latencyMs: Date.now() - start,
      agentLatencyMs,
      judgeLatencyMs: 0,
      iterations: targetResult.iterations,
      toolCallCount: targetResult.toolCallCount,
    };
  }

  const judgeStart = Date.now();
  try {
    const evalResult = await evaluateRubric(example, targetResult.answer);
    const judgeLatencyMs = Date.now() - judgeStart;
    return {
      index,
      id: example.id,
      question: example.inputs.question,
      questionType: example.questionType,
      score: evalResult.score,
      exactPass: evalResult.score === 1,
      comment: evalResult.comment,
      answer: targetResult.answer,
      contradictionDetected: evalResult.contradictionDetected,
      passedCriteria: evalResult.passedCriteria,
      totalCriteria: evalResult.totalCriteria,
      criteria: evalResult.criteria,
      latencyMs: Date.now() - start,
      agentLatencyMs,
      judgeLatencyMs,
      iterations: targetResult.iterations,
      toolCallCount: targetResult.toolCallCount,
    };
  } catch (error) {
    return {
      index,
      id: example.id,
      question: example.inputs.question,
      questionType: example.questionType,
      score: null,
      exactPass: false,
      comment: `Judge error: ${error instanceof Error ? error.message : String(error)}`,
      answer: targetResult.answer,
      failureType: 'judge_error',
      failureMessage: error instanceof Error ? error.message : String(error),
      contradictionDetected: false,
      passedCriteria: 0,
      totalCriteria: example.rubric.filter((criterion) => criterion.operator === 'correctness').length,
      criteria: [],
      latencyMs: Date.now() - start,
      agentLatencyMs,
      judgeLatencyMs: Date.now() - judgeStart,
      iterations: targetResult.iterations,
      toolCallCount: targetResult.toolCallCount,
    };
  }
}

async function ensureLangSmithDataset(
  client: Client,
  datasetName: string,
  examples: EvalExample[],
  datasetHash: string,
) {
  try {
    return await client.readDataset({ datasetName });
  } catch {
    return client.createDataset(datasetName, {
      description: `Dexter finance eval dataset hash ${datasetHash}`,
    }).then(async (dataset) => {
      await client.createExamples({
        datasetId: dataset.id,
        inputs: examples.map((example) => example.inputs),
        outputs: examples.map((example) => example.outputs),
      });
      return dataset;
    });
  }
}

async function trackResult(
  client: Client,
  experimentName: string,
  datasetName: string,
  datasetHash: string,
  example: EvalExample,
  result: EvalQuestionResult,
  options: EvalOptions,
  modelDisplayName: string,
  judgeModelDisplayName: string,
): Promise<string | undefined> {
  try {
    await client.createRun({
      name: 'dexter-eval-run',
      run_type: 'chain',
      inputs: example.inputs,
      outputs: { answer: result.answer },
      start_time: Date.now() - result.latencyMs,
      end_time: Date.now(),
      project_name: experimentName,
      extra: {
        dataset: datasetName,
        dataset_hash: datasetHash,
        question_type: example.questionType,
        expert_time_minutes: example.expertTimeMinutes,
        models: {
          target: {
            id: options.model,
            display_name: modelDisplayName,
          },
          judge: {
            id: options.judgeModel,
            display_name: judgeModelDisplayName,
          },
        },
        eval_options: {
          quick: options.quick,
          sample_size: options.sampleSize,
          seed: options.seed,
          concurrency: options.concurrency,
          timeout_ms: options.timeoutMs,
        },
        reference_outputs: example.outputs,
        evaluation: {
          score: result.score,
          exact_pass: result.exactPass,
          comment: result.comment,
          contradiction_detected: result.contradictionDetected,
          passed_criteria: result.passedCriteria,
          total_criteria: result.totalCriteria,
          criteria: result.criteria,
          failure_type: result.failureType,
          failure_message: result.failureMessage,
        },
        telemetry: {
          latency_ms: result.latencyMs,
          agent_latency_ms: result.agentLatencyMs,
          judge_latency_ms: result.judgeLatencyMs,
          iterations: result.iterations,
          tool_call_count: result.toolCallCount,
        },
      },
    });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function buildDatasetName(baseName: string, options: EvalOptions, datasetHash: string): string {
  if (options.quick) {
    return `${baseName}-${datasetHash}-quick`;
  }

  if (options.sampleSize !== undefined) {
    return `${baseName}-${datasetHash}-sample-${options.sampleSize}-${slugifyModelId(options.seed)}`;
  }

  return `${baseName}-${datasetHash}`;
}

async function* runExamples(
  examples: EvalExample[],
  options: EvalOptions,
  evaluateRubric: ReturnType<typeof createRubricEvaluator>,
): AsyncGenerator<
  | { type: 'start'; example: EvalExample; index: number }
  | { type: 'end'; example: EvalExample; result: EvalQuestionResult },
  void,
  unknown
> {
  let nextIndex = 0;
  const running = new Map<number, Promise<EvalQuestionResult>>();

  while (nextIndex < examples.length || running.size > 0) {
    while (nextIndex < examples.length && running.size < options.concurrency) {
      const index = nextIndex;
      const example = examples[index];
      yield { type: 'start', example, index };
      running.set(index, evaluateExample(example, index, options, evaluateRubric));
      nextIndex++;
    }

    const result = await Promise.race(
      [...running.entries()].map(async ([index, promise]) => ({
        index,
        result: await promise,
      })),
    );

    running.delete(result.index);
    yield {
      type: 'end',
      example: examples[result.index],
      result: result.result,
    };
  }
}

// ============================================================================
// Evaluation generator - yields progress events for the UI
// ============================================================================

function createEvaluationRunner(options: EvalOptions) {
  return async function* runEvaluation(): AsyncGenerator<EvalProgressEvent, void, unknown> {
    const modelDisplayName = getModelDisplayName(options.model);
    const judgeModelDisplayName = getModelDisplayName(options.judgeModel);
    const evaluateRubric = createRubricEvaluator(options.judgeModel);
    const csvPath = path.join(__dirname, 'dataset', 'finance_agent.csv');
    const dataset = loadEvalDataset(csvPath);
    const examples = selectEvalExamples(dataset.examples, options);
    const client = new Client();
    const datasetName = buildDatasetName('dexter-finance-eval', options, dataset.hash);

    // Yield init event
    yield {
      type: 'init',
      total: examples.length,
      datasetName: options.quick
        ? `finance_agent (quick ${examples.length}/${dataset.examples.length})`
        : options.sampleSize
          ? `finance_agent (sample ${examples.length}/${dataset.examples.length})`
          : 'finance_agent',
      model: options.model,
      modelDisplayName,
      judgeModel: options.judgeModel,
      judgeModelDisplayName,
      datasetHash: dataset.hash,
      seed: options.seed,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
    };

    let datasetSetupError: string | undefined;
    try {
      await ensureLangSmithDataset(client, datasetName, examples, dataset.hash);
    } catch (error) {
      datasetSetupError = error instanceof Error ? error.message : String(error);
    }

    // Generate experiment name for tracking
    const experimentName = [
      'dexter-eval',
      slugifyModelId(options.model),
      'judge',
      slugifyModelId(options.judgeModel),
      dataset.hash,
      Date.now().toString(36),
    ].join('-');

    for await (const event of runExamples(examples, options, evaluateRubric)) {
      if (event.type === 'start') {
        yield {
          type: 'question_start',
          index: event.index,
          question: event.example.inputs.question,
          questionType: event.example.questionType,
        };
        continue;
      }

      const { example, result } = event;
      const trackingError = await trackResult(
        client,
        experimentName,
        datasetName,
        dataset.hash,
        example,
        result,
        options,
        modelDisplayName,
        judgeModelDisplayName,
      );

      // Yield question end with result - UI updates progress bar
      yield {
        type: 'question_end',
        ...result,
        trackingError: trackingError ?? datasetSetupError,
      };
    }

    // Yield complete event
    yield {
      type: 'complete',
      experimentName,
      model: options.model,
      modelDisplayName,
      judgeModel: options.judgeModel,
      judgeModelDisplayName,
      datasetHash: dataset.hash,
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
