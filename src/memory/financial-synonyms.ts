/**
 * Financial synonym expansion for FTS5 keyword search.
 *
 * Converts financial shorthand (P/E, FCF, EPS, WACC, etc.) into OR-expanded
 * FTS5 queries so keyword search finds equivalent terminology regardless of
 * the exact phrasing used in stored memory chunks.
 *
 * Usage: call buildFtsQueryExpanded() instead of the plain AND-only builder
 * whenever query expansion is desired (i.e. for chunk search, not for exact
 * financial-insight lookups).
 */

type SynonymEntry = {
  pattern: RegExp;
  synonyms: string[];
};

const SYNONYM_MAP: SynonymEntry[] = [
  // Valuation ratios
  {
    pattern: /\bp\/e\b|\bpe\s*(ratio|multiple)?\b/i,
    synonyms: ['price to earnings', 'price earnings ratio', 'earnings multiple', 'pe multiple'],
  },
  {
    pattern: /\bp\/b\b|\bpb\s*(ratio|multiple)?\b/i,
    synonyms: ['price to book', 'price book ratio', 'book value multiple'],
  },
  {
    pattern: /\bev\/ebitda\b|\bev\s*ebitda\b/i,
    synonyms: ['enterprise value ebitda', 'ev multiple'],
  },

  // Profitability / returns
  {
    pattern: /\broe\b/i,
    synonyms: ['return on equity'],
  },
  {
    pattern: /\broa\b/i,
    synonyms: ['return on assets'],
  },
  {
    pattern: /\broic\b/i,
    synonyms: ['return on invested capital', 'return on capital'],
  },
  {
    pattern: /\bgross\s*margin\b/i,
    synonyms: ['gross profit margin', 'gross profitability'],
  },
  {
    pattern: /\bebitda\b/i,
    synonyms: ['earnings before interest tax depreciation amortization', 'operating earnings'],
  },

  // Cash flow
  {
    pattern: /\bfcf\b/i,
    synonyms: ['free cash flow', 'free cashflow'],
  },
  {
    pattern: /\bcap\s*ex\b|\bcapex\b/i,
    synonyms: ['capital expenditure', 'capital spending', 'capital expenditures'],
  },

  // Per-share metrics
  {
    pattern: /\beps\b/i,
    synonyms: ['earnings per share', 'per share earnings'],
  },
  {
    pattern: /\bdps\b/i,
    synonyms: ['dividends per share', 'dividend per share'],
  },

  // Valuation / DCF
  {
    pattern: /\bdcf\b/i,
    synonyms: ['discounted cash flow', 'intrinsic value'],
  },
  {
    pattern: /\bwacc\b/i,
    synonyms: ['weighted average cost of capital', 'cost of capital'],
  },

  // Market metrics
  {
    pattern: /\bmarket\s*cap\b|\bmcap\b/i,
    synonyms: ['market capitalization', 'market value'],
  },
  {
    pattern: /\bdividend\s*yield\b/i,
    synonyms: ['dividend payout', 'dividend rate'],
  },
  {
    pattern: /\bshort\s*(interest|float)\b/i,
    synonyms: ['short selling', 'short position', 'short interest ratio'],
  },

  // Growth periods
  {
    pattern: /\byoy\b/i,
    synonyms: ['year over year', 'year on year', 'annual growth'],
  },
  {
    pattern: /\bqoq\b/i,
    synonyms: ['quarter over quarter', 'sequential growth'],
  },
];

/** Tokenises a phrase into FTS5-safe implicit-AND tokens. */
function phraseToFtsPart(phrase: string): string {
  const tokens = phrase.match(/[\p{L}\p{N}_]+/gu) ?? [];
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t}"`).join(' ');
}

/**
 * Builds an FTS5 query from raw input with financial synonym expansion.
 *
 * For a plain query ("earnings growth") returns a simple implicit-AND string.
 * For queries containing financial abbreviations, appends OR clauses with
 * equivalent terminology so both exact and synonymous matches are found.
 *
 * Returns null when the raw query contains no searchable tokens.
 */
export function buildFtsQueryExpanded(raw: string): string | null {
  const tokens = raw.match(/[\p{L}\p{N}_]+/gu) ?? [];
  if (tokens.length === 0) return null;

  // Lowercase base tokens for consistency — FTS5 is case-insensitive anyway.
  const basePart = tokens.map((t) => `"${t.toLowerCase().replaceAll('"', '')}"`).join(' ');
  const parts: string[] = [basePart];

  for (const entry of SYNONYM_MAP) {
    if (entry.pattern.test(raw)) {
      for (const syn of entry.synonyms) {
        const ftsPart = phraseToFtsPart(syn);
        if (ftsPart && !parts.includes(ftsPart)) {
          parts.push(ftsPart);
        }
      }
    }
  }

  return parts.length === 1 ? parts[0]! : parts.join(' OR ');
}

/** Returns synonym phrases detected in the query (useful for debugging). */
export function detectSynonyms(raw: string): string[] {
  const result: string[] = [];
  for (const entry of SYNONYM_MAP) {
    if (entry.pattern.test(raw)) {
      result.push(...entry.synonyms);
    }
  }
  return result;
}
