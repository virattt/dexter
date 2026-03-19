/**
 * `brazilian_fundamentals` tool — composite LangChain tool for financial fundamentals
 * on Brazilian (B3) listed companies.
 *
 * Aggregates data from three sources in parallel:
 *  - CVM (official regulatory filings — DRE, Balanço, DFC)
 *  - Fundamentus (scraped indicator ratios)
 *  - StatusInvest (historical DRE and dividends via JSON)
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RunnableConfig } from '@langchain/core/runnables';
import { formatToolResult } from '../types.js';
import { fetchCvmFundamentals } from './cvm.js';
import { fetchFundamentusData } from './fundamentus.js';
import { fetchStatusInvestData } from './status-invest.js';
import { fetchStockHistory, fetchBrentHistory, fetchUsdBrlHistory } from './historical.js';
import { readDailyCache, writeDailyCache } from './daily-cache.js';

export const BRAZILIAN_FUNDAMENTALS_DESCRIPTION = `
Use this tool to get fundamental financial data for Brazilian (B3) listed companies.

## When to Use

- When the user asks for indicators like P/L, P/VP, ROE, ROIC, Margem Líquida, Dividend Yield, EV/EBITDA
- When the user asks for financial statements: DRE (receita, lucro, EBIT), Balanço Patrimonial, Fluxo de Caixa
- For dividend history of Brazilian stocks (PETR4, VALE3, ITUB4, BBAS3, WEGE3, etc.)
- For multi-year earnings trend ("últimos 5 anos", "evolução da receita")

## When NOT to Use

- For current stock prices — use \`brazilian_market_search\` instead
- For US/international stocks — use \`financial_metrics\` or \`financial_search\`

## Output

Returns data from CVM (official filings), Fundamentus, and StatusInvest, labeled by source.
Includes computed fields: FCF (Fluxo de Caixa Livre), Dívida Bruta, Dívida Líquida, Ações em circulação.
For historical price series (Brent, USD/BRL, stock prices), use dataType='historico'.`.trim();

const BrazilianFundamentalsSchema = z.object({
  ticker: z
    .string()
    .describe('The B3 ticker symbol, e.g. PETR4, VALE3, ITUB4, WEGE3. Without the .SA suffix.'),
  dataType: z
    .enum(['indicators', 'dre', 'balanco', 'dividends', 'all', 'historico'])
    .default('all')
    .describe(
      'Type of data: indicators (ratios), dre (income statement), balanco (balance sheet + FCF), dividends, all (everything), or historico (historical price series for the stock + Brent + USD/BRL).'
    ),
  range: z
    .enum(['1m', '3m', '6m', '1y', '3y', '5y', '10y'])
    .optional()
    .default('1y')
    .describe('Historical range for dataType=historico. Default: 1y.'),
});

export const brazilianFundamentalsTool = new DynamicStructuredTool({
  name: 'brazilian_fundamentals',
  description: BRAZILIAN_FUNDAMENTALS_DESCRIPTION,
  schema: BrazilianFundamentalsSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const ticker = input.ticker.replace(/\.SA$/i, '').toUpperCase();
    const range = (input.range ?? '1y') as '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y';

    // ─── Historical series ────────────────────────────────────────────────────
    if (input.dataType === 'historico') {
      onProgress?.(`Buscando séries históricas para ${ticker}...`);
      const [stockSeries, brentSeries, usdBrlSeries] = await Promise.all([
        fetchStockHistory(ticker, range),
        fetchBrentHistory(range),
        fetchUsdBrlHistory(range),
      ]);

      const historico: Record<string, unknown> = { ticker, range };
      if (stockSeries) historico.precosAcao   = stockSeries;
      if (brentSeries) historico.brentCrude   = brentSeries;
      if (usdBrlSeries) historico.usdBrl      = usdBrlSeries;

      const hasHistorico = stockSeries || brentSeries || usdBrlSeries;
      if (!hasHistorico) {
        return formatToolResult({ error: `Não foi possível obter séries históricas para ${ticker}.` }, []);
      }

      return formatToolResult(historico, [
        `https://finance.yahoo.com/chart/${ticker}.SA`,
        `https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes`,
      ]);
    }

    // ─── Fundamentals ─────────────────────────────────────────────────────────
    // Check daily cache first (fundamentals are quarterly/annual, safe to cache 1 day)
    if (input.dataType !== 'historico') {
      const cached = readDailyCache(ticker);
      if (cached && cached._dataType === input.dataType) {
        return formatToolResult(cached, [
          `https://www.fundamentus.com.br/detalhes.php?papel=${ticker}`,
          `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`,
        ]);
      }
    }

    onProgress?.(`Buscando dados fundamentalistas para ${ticker}...`);

    const [cvmData, fundamentusData, statusInvestData] = await Promise.all([
      fetchCvmFundamentals(ticker),
      fetchFundamentusData(ticker),
      fetchStatusInvestData(ticker),
    ]);

    const result: Record<string, unknown> = {
      ticker,
      market: 'B3 (Brasil)',
      dataSources: [] as string[],
    };

    const sources = result.dataSources as string[];

    // ─── Indicators ──────────────────────────────────────────────────────────
    if (input.dataType === 'indicators' || input.dataType === 'all') {
      const indicators: Record<string, unknown> = {};

      if (fundamentusData) {
        sources.push('Fundamentus');
        indicators.fundamentus = {
          pl: fundamentusData.pl, pvp: fundamentusData.pvp,
          pebit: fundamentusData.pebit, evEbitda: fundamentusData.evEbitda,
          evEbit: fundamentusData.evEbit, pAtivo: fundamentusData.pAtivo,
          dividendYield: fundamentusData.dividendYield, payout: fundamentusData.payout,
          roe: fundamentusData.roe, roic: fundamentusData.roic, roa: fundamentusData.roa,
          margemBruta: fundamentusData.margemBruta, margemEbit: fundamentusData.margemEbit,
          margemLiquida: fundamentusData.margemLiquida,
          dividaBruta: fundamentusData.dividaBruta, dividaLiquida: fundamentusData.dividaLiquida,
          cotacao: fundamentusData.cotacao, valorMercado: fundamentusData.valorMercado,
        };
      }

      if (statusInvestData?.indicators) {
        if (!sources.includes('StatusInvest')) sources.push('StatusInvest');
        indicators.statusInvest = statusInvestData.indicators;
      }

      if (Object.keys(indicators).length > 0) result.indicators = indicators;
    }

    // ─── DRE ─────────────────────────────────────────────────────────────────
    if (input.dataType === 'dre' || input.dataType === 'all') {
      const dre: Record<string, unknown> = {};

      if (cvmData?.dre && Object.keys(cvmData.dre).length > 0) {
        if (!sources.includes('CVM')) sources.push('CVM (oficial)');
        dre.cvm = { ...cvmData.dre, referenceDate: cvmData.referenceDate, note: 'R$ mil (IFRS consolidado)' };
      }

      if (statusInvestData?.dreHistory && statusInvestData.dreHistory.length > 0) {
        if (!sources.includes('StatusInvest')) sources.push('StatusInvest');
        dre.historico = statusInvestData.dreHistory;
      }

      if (fundamentusData) {
        dre.anoCorrente = {
          receitaLiquida: fundamentusData.receitaLiquida,
          ebit: fundamentusData.ebit, lucroLiquido: fundamentusData.lucroLiquido,
          source: 'Fundamentus',
        };
      }

      if (Object.keys(dre).length > 0) result.dre = dre;
    }

    // ─── Balanço + FCF + Ações ────────────────────────────────────────────────
    if (input.dataType === 'balanco' || input.dataType === 'all') {
      if (cvmData?.balanco && Object.keys(cvmData.balanco).length > 0) {
        if (!sources.includes('CVM')) sources.push('CVM (oficial)');
        result.balanco = { ...cvmData.balanco, referenceDate: cvmData.referenceDate, note: 'R$ mil (IFRS consolidado)' };
      }

      if (cvmData?.fluxoCaixa && Object.keys(cvmData.fluxoCaixa).length > 0) {
        if (!sources.includes('CVM')) sources.push('CVM (oficial)');
        result.fluxoCaixa = { ...cvmData.fluxoCaixa, referenceDate: cvmData.referenceDate, note: 'R$ mil — inclui FCF (fluxoCaixaLivre) e CAPEX' };
      }

      if (cvmData?.acoes && Object.keys(cvmData.acoes).length > 0) {
        result.acoes = { ...cvmData.acoes, referenceDate: cvmData.referenceDate, note: 'Número de ações em circulação (unidades)' };
      }
    }

    // ─── Dividendos ───────────────────────────────────────────────────────────
    if (input.dataType === 'dividends' || input.dataType === 'all') {
      if (statusInvestData?.dividends && statusInvestData.dividends.length > 0) {
        if (!sources.includes('StatusInvest')) sources.push('StatusInvest');
        result.dividends = statusInvestData.dividends;
      }
    }

    const hasData = ['indicators', 'dre', 'balanco', 'fluxoCaixa', 'acoes', 'dividends'].some(k => k in result);

    if (!hasData) {
      return formatToolResult(
        { error: `Não foi possível obter dados para ${ticker}. Verifique o ticker ou tente novamente mais tarde.` },
        []
      );
    }

    // Save to daily cache for subsequent queries
    writeDailyCache(ticker, { ...result, _dataType: input.dataType });

    return formatToolResult(result, [
      `https://www.fundamentus.com.br/detalhes.php?papel=${ticker}`,
      `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`,
    ]);
  },
});



