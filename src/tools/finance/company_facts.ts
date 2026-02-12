import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runFinanceProviderChain } from './providers/fallback.js';
import { fdCompanyFacts } from './providers/financialdatasets.js';
import { fmpCompanyFacts } from './providers/fmp.js';
import { avCompanyFacts } from './providers/alphavantage.js';

const CompanyFactsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch company facts for. For example, 'AAPL' for Apple."),
});

export const getCompanyFacts = new DynamicStructuredTool({
  name: 'get_company_facts',
  description: `Retrieves company facts and metadata for a given ticker, including sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares,  website. Useful for getting an overview of a company's profile and basic information.`,
  schema: CompanyFactsInputSchema,
  func: async (input) => {
    const result = await runFinanceProviderChain('get_company_facts', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdCompanyFacts(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpCompanyFacts(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avCompanyFacts(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});
