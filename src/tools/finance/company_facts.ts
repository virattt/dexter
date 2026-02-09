import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { edgarFetch, resolveCik, submissionsUrl, companyFactsUrl, type CompanyFacts } from './edgar/index.js';

const CompanyFactsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch company facts for. For example, 'AAPL' for Apple."),
});

export const getCompanyFacts = new DynamicStructuredTool({
  name: 'get_company_facts',
  description: `Retrieves company profile and metadata from SEC EDGAR, including company name, CIK, SIC code/description, state, fiscal year end, exchanges, addresses, and website. Data sourced from SEC EDGAR submissions.`,
  schema: CompanyFactsInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const subUrl = submissionsUrl(resolved.cik);

    // Fetch submissions for company metadata
    const { data: submissions, url } = await edgarFetch(subUrl, {
      cacheable: true,
      cacheKey: `edgar/submissions/${input.ticker.toUpperCase()}`,
      cacheParams: { ticker: input.ticker.toUpperCase() },
    });

    const sub = submissions as Record<string, unknown>;

    // Optionally fetch shares outstanding from company facts
    let sharesOutstanding: number | null = null;
    let website: string | null = null;
    try {
      const factsUrl = companyFactsUrl(resolved.cik);
      const { data: factsData } = await edgarFetch(factsUrl, {
        cacheable: true,
        cacheKey: `edgar/companyfacts/${input.ticker.toUpperCase()}`,
        cacheParams: { ticker: input.ticker.toUpperCase() },
      });
      const facts = factsData as unknown as CompanyFacts;

      // Shares outstanding from DEI
      const sharesUnits =
        facts.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares ??
        facts.facts?.['us-gaap']?.CommonStockSharesOutstanding?.units?.shares;
      if (sharesUnits && sharesUnits.length > 0) {
        // Get the most recent
        const sorted = [...sharesUnits].sort((a: { end: string }, b: { end: string }) =>
          b.end.localeCompare(a.end)
        );
        sharesOutstanding = (sorted[0] as { val: number }).val;
      }

      // Website from DEI
      const webUnits = facts.facts?.dei?.EntityAddressesAddressTypeOrEntityAddressAddressLine1;
      if (!webUnits) {
        const entityUrl = facts.facts?.dei?.EntityWebAddress;
        if (entityUrl) {
          const urlUnits = Object.values(entityUrl.units)[0];
          if (urlUnits && urlUnits.length > 0) {
            website = String((urlUnits[urlUnits.length - 1] as { val: unknown }).val);
          }
        }
      }
    } catch {
      // Non-critical — continue with what we have
    }

    const companyProfile: Record<string, unknown> = {
      name: sub.name ?? resolved.companyName,
      cik: resolved.cik,
      ticker: resolved.ticker,
      sicCode: sub.sic,
      sicDescription: sub.sicDescription,
      stateOfIncorporation: sub.stateOfIncorporation,
      fiscalYearEnd: sub.fiscalYearEnd,
      exchanges: sub.exchanges,
      category: sub.category,
      entityType: sub.entityType,
      addresses: sub.addresses,
      phone: sub.phone,
      sharesOutstanding,
      website,
    };

    return formatToolResult(companyProfile, [url]);
  },
});
