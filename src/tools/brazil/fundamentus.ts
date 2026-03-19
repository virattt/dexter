/**
 * Fundamentus.com.br integration.
 * Scrapes the fundamental analysis data table for a given ticker.
 * No API key required. Data is publicly available.
 */

import { logger } from '../../utils/logger.js';

const FUNDAMENTUS_BASE = 'https://www.fundamentus.com.br/detalhes.php?papel=';
const MAX_RETRIES = 3;

export interface FundamentusData {
  // Valuation
  pl?: number;             // Preço/Lucro
  pvp?: number;            // Preço/Valor Patrimonial
  pebit?: number;          // Preço/EBIT
  evEbitda?: number;       // EV/EBITDA
  evEbit?: number;         // EV/EBIT
  pAtivo?: number;         // Preço/Ativo Total
  pCapitalGiro?: number;   // Preço/Capital de Giro
  pEbitda?: number;        // Preço/EBITDA

  // Yield
  dividendYield?: number;  // Dividend Yield
  payout?: number;         // Payout

  // Rentabilidade
  roe?: number;            // Return on Equity
  roic?: number;           // Return on Invested Capital
  roa?: number;            // Return on Assets
  margemBruta?: number;    // Margem Bruta
  margemEbit?: number;     // Margem EBIT
  margemLiquida?: number;  // Margem Líquida

  // Endividamento
  dividaBruta?: number;    // Dívida Bruta/PL
  dividaLiquida?: number;  // Dívida Líquida/EBIT

  // Resultados (em milhares BRL)
  receitaLiquida?: number; // Receita Líquida
  ebit?: number;           // EBIT
  lucroLiquido?: number;   // Lucro Líquido
  caixaLiquido?: number;   // Caixa Líquido

  // Cotação
  cotacao?: number;
  valorMercado?: number;   // Valor de Mercado
  enterprise?: number;     // Enterprise Value

  source: 'Fundamentus';
}

/** Parse a Brazilian number string (e.g. "1.234,56" or "12,34%") to float. */
function parseBrNumber(raw: string): number | undefined {
  if (!raw || raw === '-' || raw === '') return undefined;
  const cleaned = raw.replace('%', '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/** Extract a value from the HTML by looking for the label in the preceding element. */
function extractTableValue(html: string, label: string): number | undefined {
  // Fundamentus renders tables like: <span class="txt">Label</span> ... <span class="txt">Value</span>
  // We search for the label and grab the next span value
  const idx = html.indexOf(`>${label}<`);
  if (idx === -1) return undefined;

  // Find the next span value after the label
  const afterLabel = html.slice(idx + label.length + 1);
  const valueMatch = afterLabel.match(/<span[^>]*class="txt"[^>]*>\s*([^<]+)\s*<\/span>/);
  if (!valueMatch) return undefined;

  return parseBrNumber(valueMatch[1].trim());
}

/** Parse the full Fundamentus detail page HTML for a ticker. */
function parseFundamentusHtml(html: string, ticker: string): FundamentusData | null {
  if (!html || html.includes('Nenhum papel encontrado')) {
    logger.warn(`[Fundamentus] Ticker "${ticker}" não encontrado. Verifique o código da ação.`);
    return null;
  }

  // Helper: extract value after a known label pattern
  const extract = (label: string) => extractTableValue(html, label);

  // For numeric values in table rows, we look for the label text in spans
  const result: FundamentusData = {
    // Valuation
    pl: extract('P/L'),
    pvp: extract('P/VP'),
    pebit: extract('P/EBIT'),
    evEbitda: extract('EV/EBITDA'),
    evEbit: extract('EV/EBIT'),
    pAtivo: extract('P/Ativo'),
    pCapitalGiro: extract('P/Cap. Giro'),
    pEbitda: extract('P/EBITDA'),

    // Yield
    dividendYield: extract('Div. Yield'),
    payout: extract('Payout'),

    // Rentabilidade
    roe: extract('ROE'),
    roic: extract('ROIC'),
    roa: extract('ROA'),
    margemBruta: extract('Mrg Bruta'),
    margemEbit: extract('Mrg Ebit'),
    margemLiquida: extract('Mrg. Líq.'),

    // Endividamento
    dividaBruta: extract('Dív. Brut/ Patrim.'),
    dividaLiquida: extract('Dív.Liq./EBIT'),

    // Resultados
    receitaLiquida: extract('Receita Líquida'),
    ebit: extract('EBIT'),
    lucroLiquido: extract('Lucro Líquido'),
    caixaLiquido: extract('Caixa Líquido'),

    // Cotação
    cotacao: extract('Cotação'),
    valorMercado: extract('Valor de mercado'),
    enterprise: extract('Valor da firma'),

    source: 'Fundamentus',
  };

  // Remove undefined keys to keep result lean
  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => v !== undefined)
  ) as FundamentusData;
}

/** Fetch fundamental indicators from Fundamentus for a given ticker. */
export async function fetchFundamentusData(ticker: string): Promise<FundamentusData | null> {
  const normalized = ticker.replace(/\.SA$/i, '').toUpperCase();
  const url = `${FUNDAMENTUS_BASE}${normalized}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          // Fundamentus blocks raw fetch without a user agent
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });

      if (!response.ok) {
        logger.warn(`[Fundamentus] HTTP ${response.status} para ${normalized} (tentativa ${attempt}/${MAX_RETRIES})`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
          continue;
        }
        return null;
      }

      const html = await response.text();
      const result = parseFundamentusHtml(html, normalized);

      // Alert if scraping returned no data at all — possible layout change
      if (result && Object.keys(result).filter(k => k !== 'source').length === 0) {
        logger.warn(`[Fundamentus] Nenhum dado extraído para ${normalized}. O layout do site pode ter mudado.`);
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[Fundamentus] Erro ao buscar ${normalized} (tentativa ${attempt}/${MAX_RETRIES}): ${msg}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }

  return null;
}
