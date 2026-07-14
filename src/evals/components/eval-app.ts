import { Container, Spacer, Text, type TUI } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';
import { EvalCurrentQuestion } from './eval-current-question.js';
import { EvalProgress } from './eval-progress.js';
import { EvalRecentResults, type EvalResult } from './eval-recent-results.js';
import { EvalStats } from './eval-stats.js';

const SHOW_STATS = true;

interface EvalState {
  status: 'loading' | 'running' | 'complete';
  total: number;
  completed: number;
  correct: number;
  currentQuestion: string | null;
  results: EvalResult[];
  startTime: number;
  experimentName: string | null;
  datasetName: string | null;
  datasetHash: string | null;
  seed: string | null;
  concurrency: number | null;
  timeoutMs: number | null;
  model: string | null;
  modelDisplayName: string | null;
  judgeModel: string | null;
  judgeModelDisplayName: string | null;
}

export interface EvalProgressEvent {
  type: 'init' | 'question_start' | 'question_end' | 'complete';
  total?: number;
  datasetName?: string;
  index?: number;
  question?: string;
  questionType?: string;
  score?: number | null;
  exactPass?: boolean;
  comment?: string;
  experimentName?: string;
  averageScore?: number;
  model?: string;
  modelDisplayName?: string;
  judgeModel?: string;
  judgeModelDisplayName?: string;
  datasetHash?: string;
  seed?: string;
  concurrency?: number;
  timeoutMs?: number;
  failureType?: string;
  failureMessage?: string;
  trackingError?: string;
  contradictionDetected?: boolean;
  passedCriteria?: number;
  totalCriteria?: number;
  latencyMs?: number;
}

export class EvalApp extends Container {
  private readonly tui: TUI;
  private readonly runEvaluation: () => AsyncGenerator<EvalProgressEvent, void, unknown>;
  private readonly progress = new EvalProgress();
  private readonly currentQuestion: EvalCurrentQuestion;
  private readonly stats: EvalStats;
  private readonly recentResults = new EvalRecentResults();
  private state: EvalState = {
    status: 'loading',
    total: 0,
    completed: 0,
    correct: 0,
    currentQuestion: null,
    results: [],
    startTime: Date.now(),
    experimentName: null,
    datasetName: null,
    datasetHash: null,
    seed: null,
    concurrency: null,
    timeoutMs: null,
    model: null,
    modelDisplayName: null,
    judgeModel: null,
    judgeModelDisplayName: null,
  };

  constructor(tui: TUI, runEvaluation: () => AsyncGenerator<EvalProgressEvent, void, unknown>) {
    super();
    this.tui = tui;
    this.runEvaluation = runEvaluation;
    this.currentQuestion = new EvalCurrentQuestion(tui);
    this.stats = new EvalStats(tui);
    this.renderState();
  }

  async run() {
    for await (const event of this.runEvaluation()) {
      switch (event.type) {
        case 'init':
          this.state = {
            ...this.state,
            status: 'running',
            total: event.total ?? 0,
            datasetName: event.datasetName ?? null,
            datasetHash: event.datasetHash ?? null,
            seed: event.seed ?? null,
            concurrency: event.concurrency ?? null,
            timeoutMs: event.timeoutMs ?? null,
            model: event.model ?? null,
            modelDisplayName: event.modelDisplayName ?? null,
            judgeModel: event.judgeModel ?? null,
            judgeModelDisplayName: event.judgeModelDisplayName ?? null,
            startTime: Date.now(),
          };
          break;
        case 'question_start':
          this.state = {
            ...this.state,
            currentQuestion: event.question ?? null,
          };
          break;
        case 'question_end':
          this.state = {
            ...this.state,
            completed: this.state.completed + 1,
            correct: this.state.correct + (event.exactPass ? 1 : 0),
            currentQuestion: null,
            results: [
              ...this.state.results,
              {
                index: event.index ?? this.state.results.length,
                question: event.question ?? '',
                questionType: event.questionType ?? '',
                score: event.score ?? null,
                comment: event.comment ?? '',
                failureType: event.failureType,
                trackingError: event.trackingError,
                contradictionDetected: event.contradictionDetected ?? false,
                passedCriteria: event.passedCriteria ?? 0,
                totalCriteria: event.totalCriteria ?? 0,
                latencyMs: event.latencyMs ?? 0,
              },
            ].sort((a, b) => a.index - b.index),
          };
          break;
        case 'complete':
          this.state = {
            ...this.state,
            status: 'complete',
            experimentName: event.experimentName ?? null,
            datasetHash: event.datasetHash ?? this.state.datasetHash,
            model: event.model ?? this.state.model,
            modelDisplayName: event.modelDisplayName ?? this.state.modelDisplayName,
            judgeModel: event.judgeModel ?? this.state.judgeModel,
            judgeModelDisplayName: event.judgeModelDisplayName ?? this.state.judgeModelDisplayName,
            currentQuestion: null,
          };
          break;
      }

      this.renderState();
      this.tui.requestRender();
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }

  dispose() {
    this.currentQuestion.dispose();
    this.stats.dispose();
  }

  private renderState() {
    this.clear();

    if (this.state.status === 'loading') {
      this.addChild(new Text(theme.bold(theme.primary('Dexter Eval')), 0, 0));
      this.addChild(new Text(theme.muted('Loading dataset...'), 0, 0));
      return;
    }

    if (this.state.status === 'complete') {
      this.renderCompleteState();
      return;
    }

    this.renderRunningState();
  }

  private renderRunningState() {
    this.addChild(new Text(`${theme.bold(theme.primary('Dexter Eval'))}${theme.muted(this.headerDetails())}`, 0, 0));
    this.addChild(new Spacer(1));

    this.progress.setProgress(this.state.completed, this.state.total);
    this.addChild(this.progress);

    this.currentQuestion.setQuestion(this.state.currentQuestion);
    if (this.state.currentQuestion) {
      this.addChild(new Spacer(1));
      this.addChild(this.currentQuestion);
    }

    if (SHOW_STATS) {
      this.addChild(new Spacer(1));
      this.stats.setStats({ ...this.summaryStats(), startTime: this.state.startTime });
      this.addChild(this.stats);
    }

    this.recentResults.setResults(this.state.results, 5);
    if (this.state.results.length > 0) {
      this.addChild(new Spacer(1));
      this.addChild(this.recentResults);
    }
  }

  private renderCompleteState() {
    this.currentQuestion.setQuestion(null);
    this.stats.setStats({ ...this.summaryStats(), startTime: null });

    const stats = this.summaryStats();

    this.addChild(new Text('═'.repeat(70), 0, 0));
    this.addChild(new Text(theme.bold('EVALUATION COMPLETE'), 0, 0));
    this.addChild(new Text('═'.repeat(70), 0, 0));
    this.addChild(new Text(`Experiment: ${this.state.experimentName ?? 'unknown'}`, 0, 0));
    this.addChild(new Text(`Target model: ${this.modelLabel('target')}`, 0, 0));
    this.addChild(new Text(`Judge model: ${this.modelLabel('judge')}`, 0, 0));
    this.addChild(new Text(`Dataset hash: ${this.state.datasetHash ?? 'unknown'}`, 0, 0));
    this.addChild(new Text(`Examples evaluated: ${this.state.results.length}`, 0, 0));
    this.addChild(
      new Text(
        `Average rubric score: ${theme.bold(theme.primary(`${(stats.averageScore * 100).toFixed(1)}%`))}`,
        0,
        0,
      ),
    );
    this.addChild(new Text(`Exact passes: ${stats.exactPass}`, 0, 0));
    this.addChild(new Text(`Contradictions: ${stats.contradictions}`, 0, 0));
    this.addChild(new Text(`Infrastructure failures: ${stats.failures}`, 0, 0));
    this.addChild(new Text(`Tracking errors: ${stats.trackingErrors}`, 0, 0));
    this.addChild(new Spacer(1));
    this.renderQuestionTypeSummary();
    this.addChild(new Spacer(1));
    this.addChild(new Text('Results by question:', 0, 0));
    this.addChild(new Text('─'.repeat(70), 0, 0));

    for (const result of this.state.results) {
      const hasFailure = Boolean(result.failureType);
      const icon = hasFailure ? '!' : result.score === 1 ? '✓' : result.contradictionDetected ? '✗' : '~';
      const iconColor = hasFailure || result.contradictionDetected
        ? theme.error
        : result.score === 1
          ? theme.success
          : theme.primary;
      const scoreLabel = result.score === null ? 'n/a' : result.score.toFixed(2);
      this.addChild(
        new Text(
          `${iconColor(icon)} ${theme.muted(`[${scoreLabel}]`)} ${theme.muted(result.questionType)} ${this.truncate(result.question, 48)}`,
          0,
          0,
        ),
      );
      if (result.comment && result.score !== 1) {
        this.addChild(new Text(`    ${theme.muted(this.truncate(result.comment, 80))}`, 0, 0));
      }
    }

    this.addChild(new Spacer(1));
    this.addChild(new Text('─'.repeat(70), 0, 0));
    this.addChild(new Text(theme.muted('View full results: https://smith.langchain.com'), 0, 0));
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength)}...`;
  }

  private headerDetails(): string {
    const details = [
      this.state.datasetName,
      this.state.datasetHash ? `Hash: ${this.state.datasetHash}` : null,
      `Target: ${this.modelLabel('target')}`,
      `Judge: ${this.modelLabel('judge')}`,
      this.state.seed ? `Seed: ${this.state.seed}` : null,
    ].filter(Boolean);

    return details.length > 0 ? ` • ${details.join(' • ')}` : '';
  }

  private modelLabel(kind: 'target' | 'judge'): string {
    const id = kind === 'target' ? this.state.model : this.state.judgeModel;
    const displayName =
      kind === 'target' ? this.state.modelDisplayName : this.state.judgeModelDisplayName;

    if (!id && !displayName) {
      return 'unknown';
    }

    if (!id || id === displayName) {
      return displayName ?? id ?? 'unknown';
    }

    return `${displayName ?? id} (${id})`;
  }

  private summaryStats() {
    const scored = this.state.results.filter((result) => typeof result.score === 'number');
    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, result) => sum + (result.score ?? 0), 0) / scored.length
        : 0;

    return {
      exactPass: this.state.results.filter((result) => result.score === 1).length,
      completed: this.state.completed,
      averageScore,
      contradictions: this.state.results.filter((result) => result.contradictionDetected).length,
      failures: this.state.results.filter((result) => Boolean(result.failureType)).length,
      trackingErrors: this.state.results.filter((result) => Boolean(result.trackingError)).length,
    };
  }

  private renderQuestionTypeSummary() {
    const byType = new Map<string, { count: number; score: number; latencyMs: number }>();

    for (const result of this.state.results) {
      if (typeof result.score !== 'number') {
        continue;
      }
      const current = byType.get(result.questionType) ?? { count: 0, score: 0, latencyMs: 0 };
      current.count++;
      current.score += result.score;
      current.latencyMs += result.latencyMs;
      byType.set(result.questionType, current);
    }

    if (byType.size === 0) {
      return;
    }

    this.addChild(new Text('By question type:', 0, 0));
    for (const [questionType, stats] of [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const avgScore = (stats.score / stats.count) * 100;
      const avgLatencySeconds = stats.latencyMs / stats.count / 1000;
      this.addChild(
        new Text(
          `${questionType}: ${avgScore.toFixed(1)}% avg, ${avgLatencySeconds.toFixed(1)}s avg latency (${stats.count})`,
          0,
          0,
        ),
      );
    }
  }
}
