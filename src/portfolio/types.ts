import type { CronSchedule } from '@/cron/types';

export type PortfolioHolding = {
  ticker: string;
  weight?: number;
  notes?: string;
};

export type PortfolioDefinition = {
  id: string;
  name: string;
  enabled: boolean;
  holdings: PortfolioHolding[];
  benchmark?: string;
  watchlist?: string[];
  schedule?: CronSchedule;
  model?: string;
  modelProvider?: string;
};

export type PortfolioConfig = {
  version: 1;
  defaults?: {
    schedule?: CronSchedule;
    model?: string;
    modelProvider?: string;
    benchmark?: string;
  };
  portfolios: PortfolioDefinition[];
};

export type PortfolioDiagnostics = {
  duration_ms: number;
  holdings_analyzed: number;
  warnings: string[];
  errors: string[];
};

export type PortfolioHoldingResult = {
  ticker: string;
  weight?: number;
  highlights: string[];
  news: string[];
  events: string[];
  status: 'quiet' | 'notable' | 'error';
  errors: string[];
};

export type PortfolioAnalysisResult = {
  ok: boolean;
  run_id: string;
  trigger: 'manual' | 'manual-job' | 'scheduled';
  generated_at: string;
  portfolio: {
    id: string;
    name: string;
    benchmark?: string;
  };
  model: {
    id: string;
    provider: string;
    source: 'cli' | 'portfolio' | 'global' | 'default' | 'cron';
  };
  summary: {
    headline: string;
    overall_view: string;
    top_risks: string[];
    top_opportunities: string[];
    follow_ups: string[];
  };
  holdings: PortfolioHoldingResult[];
  portfolio_highlights: string[];
  diagnostics: PortfolioDiagnostics;
  final_text: string;
};

export type PortfolioValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  config?: PortfolioConfig;
};

export type EffectiveModelConfig = {
  model: string;
  provider: string;
  source: 'cli' | 'portfolio' | 'global' | 'default' | 'cron';
};
