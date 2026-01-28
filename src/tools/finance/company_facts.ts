import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

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
    const { data, url } = await callApi('/company/facts', { ticker: input.ticker });
    return formatToolResult(data.company_facts || {}, [url]);
  },
});
