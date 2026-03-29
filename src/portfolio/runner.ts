import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { runAgentForMessage } from '@/gateway/agent-runner';
import { persistLatestPortfolioRun } from './config';
import type { PortfolioDefinition, PortfolioAnalysisResult, EffectiveModelConfig, PortfolioHoldingResult } from './types';
import { assertPortfolioProviderReady } from './model-resolution';

const holdingResultSchema = z.object({
  ticker: z.string(),
  weight: z.number().optional(),
  highlights: z.array(z.string()).default([]),
  news: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
  status: z.enum(['quiet', 'notable', 'error']).default('quiet'),
  errors: z.array(z.string()).default([]),
});

const portfolioOutputSchema = z.object({
  summary: z.object({
    headline: z.string(),
    overall_view: z.string(),
    top_risks: z.array(z.string()).default([]),
    top_opportunities: z.array(z.string()).default([]),
    follow_ups: z.array(z.string()).default([]),
  }),
  holdings: z.array(holdingResultSchema).default([]),
  portfolio_highlights: z.array(z.string()).default([]),
  final_text: z.string(),
});

function buildModelMetadata(config: EffectiveModelConfig): PortfolioAnalysisResult['model'] {
  return {
    id: config.model,
    provider: config.provider,
    source: config.source,
  };
}

function buildPortfolioPrompt(portfolio: PortfolioDefinition): string {
  const holdings = portfolio.holdings
    .map((holding) => `- ${holding.ticker}${holding.weight !== undefined ? ` (${(holding.weight * 100).toFixed(1)}%)` : ''}${holding.notes ? ` — ${holding.notes}` : ''}`)
    .join('\n');
  const watchlist = portfolio.watchlist?.length ? portfolio.watchlist.join(', ') : 'none';
  const benchmark = portfolio.benchmark ?? 'none';

  return `You are performing daily analysis for a stock portfolio.

Portfolio name: ${portfolio.name}
Portfolio id: ${portfolio.id}
Benchmark: ${benchmark}
Watchlist: ${watchlist}

Holdings:
${holdings}

Use Dexter's financial/news/filing tools to analyze the portfolio as it stands today.

Return JSON only. Do not wrap the JSON in markdown code fences.

JSON schema:
{
  "summary": {
    "headline": "string",
    "overall_view": "string",
    "top_risks": ["string"],
    "top_opportunities": ["string"],
    "follow_ups": ["string"]
  },
  "holdings": [
    {
      "ticker": "string",
      "weight": 0.12,
      "highlights": ["string"],
      "news": ["string"],
      "events": ["string"],
      "status": "quiet|notable|error",
      "errors": ["string"]
    }
  ],
  "portfolio_highlights": ["string"],
  "final_text": "string"
}

Rules:
- Focus on today’s notable changes, earnings, filings, and company-specific events
- Keep the result compact and automation-friendly
- Include every portfolio holding in the holdings array, even if status is "quiet"
- If you cannot fully analyze a holding, mark status as "error" and explain why in errors
- final_text should be a concise human-readable summary`;
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizeHoldingResults(
  portfolio: PortfolioDefinition,
  parsedHoldings: PortfolioHoldingResult[],
): PortfolioHoldingResult[] {
  const byTicker = new Map(parsedHoldings.map((holding) => [holding.ticker.toUpperCase(), holding]));

  return portfolio.holdings.map((holding) => {
    const existing = byTicker.get(holding.ticker);
    if (existing) {
      return {
        ...existing,
        ticker: holding.ticker,
        weight: holding.weight ?? existing.weight,
      };
    }

    return {
      ticker: holding.ticker,
      weight: holding.weight,
      highlights: [],
      news: [],
      events: [],
      status: 'error',
      errors: ['Holding was not included in the model output.'],
    };
  });
}

export async function runPortfolioAnalysis(params: {
  portfolio: PortfolioDefinition;
  modelConfig: EffectiveModelConfig;
  trigger: PortfolioAnalysisResult['trigger'];
  maxIterations?: number;
}): Promise<PortfolioAnalysisResult> {
  const startedAt = Date.now();
  const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const model = buildModelMetadata(params.modelConfig);

  await assertPortfolioProviderReady(params.modelConfig);

  let answer = '';
  try {
    answer = await runAgentForMessage({
      sessionKey: `portfolio:${params.portfolio.id}:${runId}`,
      query: buildPortfolioPrompt(params.portfolio),
      model: params.modelConfig.model,
      modelProvider: params.modelConfig.provider,
      maxIterations: params.maxIterations ?? 8,
      isolatedSession: true,
      channel: 'cli',
    });
  } catch (error) {
    const result: PortfolioAnalysisResult = {
      ok: false,
      run_id: runId,
      trigger: params.trigger,
      generated_at: new Date().toISOString(),
      portfolio: {
        id: params.portfolio.id,
        name: params.portfolio.name,
        benchmark: params.portfolio.benchmark,
      },
      model,
      summary: {
        headline: 'Portfolio analysis failed',
        overall_view: 'Dexter could not complete the portfolio run.',
        top_risks: [],
        top_opportunities: [],
        follow_ups: [],
      },
      holdings: normalizeHoldingResults(params.portfolio, []),
      portfolio_highlights: [],
      diagnostics: {
        duration_ms: Date.now() - startedAt,
        holdings_analyzed: params.portfolio.holdings.length,
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)],
      },
      final_text: '',
    };
    persistLatestPortfolioRun(params.portfolio.id, result);
    return result;
  }

  const jsonText = extractJsonObject(answer);
  if (!jsonText) {
    const result: PortfolioAnalysisResult = {
      ok: false,
      run_id: runId,
      trigger: params.trigger,
      generated_at: new Date().toISOString(),
      portfolio: {
        id: params.portfolio.id,
        name: params.portfolio.name,
        benchmark: params.portfolio.benchmark,
      },
      model,
      summary: {
        headline: 'Portfolio analysis returned non-JSON output',
        overall_view: 'Dexter completed the run but did not return the required JSON contract.',
        top_risks: [],
        top_opportunities: [],
        follow_ups: [],
      },
      holdings: normalizeHoldingResults(params.portfolio, []),
      portfolio_highlights: [],
      diagnostics: {
        duration_ms: Date.now() - startedAt,
        holdings_analyzed: params.portfolio.holdings.length,
        warnings: [],
        errors: ['The model output did not contain a valid JSON object.'],
      },
      final_text: answer,
    };
    persistLatestPortfolioRun(params.portfolio.id, result);
    return result;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (error) {
    const result: PortfolioAnalysisResult = {
      ok: false,
      run_id: runId,
      trigger: params.trigger,
      generated_at: new Date().toISOString(),
      portfolio: {
        id: params.portfolio.id,
        name: params.portfolio.name,
        benchmark: params.portfolio.benchmark,
      },
      model,
      summary: {
        headline: 'Portfolio analysis returned invalid JSON',
        overall_view: 'Dexter completed the run but the JSON payload could not be parsed.',
        top_risks: [],
        top_opportunities: [],
        follow_ups: [],
      },
      holdings: normalizeHoldingResults(params.portfolio, []),
      portfolio_highlights: [],
      diagnostics: {
        duration_ms: Date.now() - startedAt,
        holdings_analyzed: params.portfolio.holdings.length,
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)],
      },
      final_text: answer,
    };
    persistLatestPortfolioRun(params.portfolio.id, result);
    return result;
  }

  const parsed = portfolioOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const result: PortfolioAnalysisResult = {
      ok: false,
      run_id: runId,
      trigger: params.trigger,
      generated_at: new Date().toISOString(),
      portfolio: {
        id: params.portfolio.id,
        name: params.portfolio.name,
        benchmark: params.portfolio.benchmark,
      },
      model,
      summary: {
        headline: 'Portfolio analysis returned invalid JSON schema',
        overall_view: 'Dexter completed the run but the JSON shape did not match the expected contract.',
        top_risks: [],
        top_opportunities: [],
        follow_ups: [],
      },
      holdings: normalizeHoldingResults(params.portfolio, []),
      portfolio_highlights: [],
      diagnostics: {
        duration_ms: Date.now() - startedAt,
        holdings_analyzed: params.portfolio.holdings.length,
        warnings: [],
        errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'result'}: ${issue.message}`),
      },
      final_text: answer,
    };
    persistLatestPortfolioRun(params.portfolio.id, result);
    return result;
  }

  const result: PortfolioAnalysisResult = {
    ok: true,
    run_id: runId,
    trigger: params.trigger,
    generated_at: new Date().toISOString(),
    portfolio: {
      id: params.portfolio.id,
      name: params.portfolio.name,
      benchmark: params.portfolio.benchmark,
    },
    model,
    summary: parsed.data.summary,
    holdings: normalizeHoldingResults(params.portfolio, parsed.data.holdings),
    portfolio_highlights: parsed.data.portfolio_highlights,
    diagnostics: {
      duration_ms: Date.now() - startedAt,
      holdings_analyzed: params.portfolio.holdings.length,
      warnings: [],
      errors: [],
    },
    final_text: parsed.data.final_text,
  };

  persistLatestPortfolioRun(params.portfolio.id, result);
  return result;
}
