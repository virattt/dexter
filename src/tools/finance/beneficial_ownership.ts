import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_1H } from './utils.js';

const BeneficialOwnershipInputSchema = z
  .object({
    ticker: z
      .string()
      .optional()
      .describe("The subject company's ticker (e.g. 'BB') to find its 5%+ beneficial owners. Provide ticker for 'who owns X' questions."),
    filer_name: z
      .string()
      .optional()
      .describe("Beneficial owner name or prefix (e.g. 'SABA', 'ELLIOTT', 'ICAHN'). The tool resolves this to the matching filer's CIK automatically. Use this for 'what stakes does X hold' questions when you only know the owner's name."),
    filer_cik: z
      .string()
      .optional()
      .describe("The filer CIK to fetch their stakes across companies (e.g. '0001510281' for Saba Capital). Will be zero-padded to 10 digits. Only use this when you already know the CIK; otherwise pass filer_name instead."),
    type: z
      .enum(['activist', 'passive'])
      .optional()
      .describe("Filter by stake type: 'activist' (Schedule 13D, intent to influence control) or 'passive' (Schedule 13G). Omit for both."),
    history: z
      .boolean()
      .optional()
      .describe('When true, returns the full amendment history of each stake instead of only its current state (the default).'),
    limit: z
      .number()
      .default(10)
      .describe('Maximum rows to return (default: 10, max: 1000).'),
    filing_date: z
      .string()
      .optional()
      .describe('Exact filing date to filter by (YYYY-MM-DD).'),
    filing_date_gte: z
      .string()
      .optional()
      .describe('Filter for filings on or after this date (YYYY-MM-DD).'),
    filing_date_lte: z
      .string()
      .optional()
      .describe('Filter for filings on or before this date (YYYY-MM-DD).'),
    filing_date_gt: z
      .string()
      .optional()
      .describe('Filter for filings strictly after this date (YYYY-MM-DD).'),
    filing_date_lt: z
      .string()
      .optional()
      .describe('Filter for filings strictly before this date (YYYY-MM-DD).'),
  })
  .refine(
    (v) => [v.ticker, v.filer_name, v.filer_cik].filter(Boolean).length === 1,
    { message: 'Provide exactly one of `ticker`, `filer_name`, or `filer_cik`.' },
  );

async function resolveFilerCik(name: string): Promise<{ cik: string; resolvedName: string } | null> {
  const { data } = await api.get(
    '/beneficial-ownership/filers/',
    { name },
    { cacheable: true, ttlMs: TTL_1H },
  );
  const filers = (data.filers as Array<{ filer_cik?: string; name?: string }> | undefined) ?? [];
  const first = filers[0];
  if (!first?.filer_cik) return null;
  return { cik: first.filer_cik, resolvedName: first.name ?? name };
}

export const getBeneficialOwnership = new DynamicStructuredTool({
  name: 'get_beneficial_ownership',
  description: `Retrieves beneficial-ownership stakes (holders of more than 5% of a company's shares) from SEC Schedules 13D and 13G. Schedule 13D stakes are ACTIVIST (intent to influence control: proxy fights, board seats, pushing for a sale) and appear within about a minute of hitting EDGAR; Schedule 13G stakes are passive (large asset managers). Three query modes (provide exactly one):

- \`ticker: "BB"\` → every 5%+ owner of that company. Use for "who owns X" / "any activists in X" questions.
- \`filer_name: "SABA"\` → that owner's stakes across companies. The tool resolves the name to a CIK internally. This is the preferred mode for owner/activist queries by name.
- \`filer_cik: "0001510281"\` → same as filer_name but when you already know the exact CIK.

Use \`type: "activist"\` to isolate 13D stakes. By default each stake's CURRENT state is returned (the most recent filing in its amendment chain); set \`history: true\` for the full chain. Each row is one reporting person with their voting/dispositive powers, percent_of_class, and (for 13D) the stated purpose_of_transaction. Coverage begins January 2025.`,
  schema: BeneficialOwnershipInputSchema,
  func: async (input) => {
    let filerCik = input.filer_cik ? input.filer_cik.padStart(10, '0') : undefined;

    if (!filerCik && input.filer_name) {
      const resolved = await resolveFilerCik(input.filer_name.trim());
      if (!resolved) {
        return formatToolResult(
          { error: `No beneficial owner found matching "${input.filer_name}".` },
          [],
        );
      }
      filerCik = resolved.cik.padStart(10, '0');
    }

    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker ? input.ticker.toUpperCase().trim() : undefined,
      filer_cik: filerCik,
      type: input.type,
      history: input.history ? 'true' : undefined,
      limit: input.limit,
      filing_date: input.filing_date,
      filing_date_gte: input.filing_date_gte,
      filing_date_lte: input.filing_date_lte,
      filing_date_gt: input.filing_date_gt,
      filing_date_lt: input.filing_date_lt,
    };
    const { data, url } = await api.get('/beneficial-ownership/', params, {
      cacheable: true,
      ttlMs: TTL_1H,
    });
    return formatToolResult(data.beneficial_owners ?? [], [url]);
  },
});
