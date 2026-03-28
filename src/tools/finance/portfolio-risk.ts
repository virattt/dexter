import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { WatchlistController } from '../../controllers/watchlist-controller.js';
import { buildPortfolioRiskReport } from '../../utils/portfolio-stats.js';

export const PORTFOLIO_RISK_DESCRIPTION = `
Computes portfolio risk metrics — VaR, CVaR (Expected Shortfall), Sharpe ratio,
annualised volatility, max drawdown, and correlation matrix — for a set of tickers.

When to use this tool:
- User asks about portfolio risk, risk metrics, or position sizing
- User wants to know VaR (Value at Risk) or drawdown for their watchlist
- User asks "how correlated are my holdings?" or "what is my Sharpe ratio?"
- User wants to assess concentration risk across positions
- A portfolio_risk skill step calls this tool

When NOT to use this tool:
- For a single stock's current price or fundamentals (use get_financials instead)
- For screening stocks by financial ratios (use stock_screener)
- When the user has no watchlist and no tickers are provided

Inputs:
- tickers: optional list of ticker symbols; if omitted, reads from the user's watchlist
- lookback_days: historical window for price data (default 252 ≈ 1 trading year)
- confidence_level: VaR / CVaR confidence (default 0.95)
- risk_free_rate: annual risk-free rate used for Sharpe (default 0.05)

Output:
- Per-ticker: volatility, Sharpe, VaR, CVaR, maxDrawdown
- Correlation matrix across all tickers
- Equal-weighted portfolio-level aggregates
`.trim();

const PortfolioRiskInputSchema = z.object({
  tickers: z
    .array(z.string())
    .optional()
    .describe('Ticker symbols to analyse. Omit to auto-read from the user watchlist.'),
  lookback_days: z
    .number()
    .int()
    .min(20)
    .max(1260)
    .default(252)
    .describe('Number of trading days of history to pull (default 252 ≈ 1 year).'),
  confidence_level: z
    .number()
    .min(0.5)
    .max(0.999)
    .default(0.95)
    .describe('Confidence level for VaR / CVaR (default 0.95).'),
  risk_free_rate: z
    .number()
    .min(0)
    .max(1)
    .default(0.05)
    .describe('Annual risk-free rate used for Sharpe ratio (default 0.05 = 5%).'),
});

/** Return a YYYY-MM-DD date that is `days` calendar days in the past. */
function dateNDaysAgo(days: number): string {
  const d = new Date();
  // Buffer for weekends + holidays so we get enough trading days.
  d.setDate(d.getDate() - Math.ceil(days * 1.45));
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const portfolioRiskTool = new DynamicStructuredTool({
  name: 'portfolio_risk',
  description: PORTFOLIO_RISK_DESCRIPTION,
  schema: PortfolioRiskInputSchema,
  func: async (input) => {
    if (!process.env.FINANCIAL_DATASETS_API_KEY) {
      return formatToolResult({
        error: 'FINANCIAL_DATASETS_API_KEY is not set. Portfolio risk analysis requires historical price data.',
      });
    }

    // Resolve ticker list
    let tickers: string[] = (input.tickers ?? []).map((t) => t.trim().toUpperCase());
    if (tickers.length === 0) {
      try {
        const entries = new WatchlistController(process.cwd()).list();
        tickers = entries.map((e) => e.ticker);
      } catch {
        // watchlist unreadable — fall through to empty-list error below
      }
    }

    if (tickers.length === 0) {
      return formatToolResult({
        error:
          'No tickers provided and watchlist is empty. Add tickers to /watchlist or pass them explicitly.',
      });
    }

    const startDate = dateNDaysAgo(input.lookback_days);
    const endDate = todayStr();
    const sourceUrls: string[] = [];

    // Fetch close-price history for each ticker in parallel
    const pricesByTicker: Record<string, number[]> = {};
    const errors: string[] = [];

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const { data, url } = await api.get('/prices/', {
            ticker,
            interval: 'day',
            start_date: startDate,
            end_date: endDate,
          });
          sourceUrls.push(url);
          const prices: number[] = ((data as { prices?: unknown[] }).prices ?? [])
            .map((p) => (p as { close: number }).close)
            .filter((v): v is number => typeof v === 'number' && isFinite(v));
          if (prices.length < 20) {
            errors.push(`${ticker}: insufficient price history (${prices.length} days)`);
            return;
          }
          pricesByTicker[ticker] = prices;
        } catch (err) {
          errors.push(
            `${ticker}: price fetch failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );

    const validTickers = Object.keys(pricesByTicker);
    if (validTickers.length === 0) {
      return formatToolResult({ error: 'Could not fetch price data for any ticker.', errors });
    }

    // Equal weights
    const w = 1 / validTickers.length;
    const weights: Record<string, number> = Object.fromEntries(
      validTickers.map((t) => [t, w]),
    );

    const report = buildPortfolioRiskReport(
      pricesByTicker,
      weights,
      input.confidence_level,
      input.risk_free_rate,
    );

    const result: Record<string, unknown> = report as unknown as Record<string, unknown>;
    if (errors.length > 0) result['warnings'] = errors;

    return formatToolResult(result, sourceUrls);
  },
});
