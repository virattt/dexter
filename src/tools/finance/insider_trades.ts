import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { edgarFetch, resolveCik, submissionsUrl } from './edgar/index.js';

const InsiderTradesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch insider trades for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(20)
    .describe('Maximum number of insider trade filings to return (default: 20, max: 50).'),
});

export const getInsiderTrades = new DynamicStructuredTool({
  name: 'get_insider_trades',
  description: `Retrieves insider trading activity for a company by fetching Form 4 filings from SEC EDGAR. Returns filing metadata including reporter name, filing date, accession number, and document URL. Note: returns filing metadata only — does not parse the XML transaction details.`,
  schema: InsiderTradesInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const subUrl = submissionsUrl(resolved.cik);
    const { data, url } = await edgarFetch(subUrl, {
      cacheable: true,
      cacheKey: `edgar/submissions/${input.ticker.toUpperCase()}`,
      cacheParams: { ticker: input.ticker.toUpperCase() },
    });

    const sub = data as Record<string, unknown>;
    const recent = (sub.filings as Record<string, unknown>)?.recent as {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    } | undefined;

    if (!recent || !recent.accessionNumber) {
      return formatToolResult([], [url]);
    }

    // Filter for Form 4 filings (insider trades)
    const maxLimit = Math.min(input.limit, 50);
    const form4Filings: Record<string, unknown>[] = [];

    for (let i = 0; i < recent.accessionNumber.length && form4Filings.length < maxLimit; i++) {
      if (recent.form[i] === '4') {
        const cleanAccession = recent.accessionNumber[i].replace(/-/g, '');
        form4Filings.push({
          accessionNumber: recent.accessionNumber[i],
          filingDate: recent.filingDate[i],
          form: recent.form[i],
          description: recent.primaryDocDescription[i],
          documentUrl: `https://www.sec.gov/Archives/edgar/data/${resolved.cikRaw}/${cleanAccession}/${recent.primaryDocument[i]}`,
        });
      }
    }

    return formatToolResult(form4Filings, [url]);
  },
});
