import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { tavilySearch } from '../search/tavily.js';

export const EARNINGS_TRANSCRIPT_DESCRIPTION = `
Fetches earnings call transcripts for a stock from SEC EDGAR 8-K filings. Returns management prepared remarks, forward guidance statements, and Q&A highlights from the most recent (or specified) earnings call. Use for management tone analysis, guidance extraction, or when the user asks about what management said on an earnings call.

## When to Use
- User asks about earnings call, management commentary, guidance, or forward guidance
- User wants to know what the CEO/CFO said about future performance
- Analyzing management tone or credibility
- Extracting specific guidance numbers from earnings calls

## Example Queries
- "What did AAPL management say on the last earnings call?"
- "What is NVDA's guidance for next quarter?"
- "Summarize the key points from MSFT's Q2 2025 earnings call"
- "What forward guidance did Tesla provide?"
`.trim();

const EarningsTranscriptInputSchema = z.object({
  ticker: z.string().describe("Stock ticker symbol, e.g. 'AAPL'"),
  quarter: z
    .string()
    .optional()
    .describe("Quarter filter e.g. 'Q1 2025'. Omit for most recent."),
});

/** Strip HTML tags and collapse whitespace from an HTML string. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Extract lines containing forward-looking guidance keywords. */
export function extractGuidancePhrases(text: string): string[] {
  const futureTense = /\b(will|expect|guidance|forecast|outlook|target|anticipate|project|million|billion|grow|increase|decrease|plan|intend)\b/i;
  const lines = text.split(/[.\n]+/);
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && futureTense.test(l))
    .slice(0, 10);
}

/** Split transcript text into prepared remarks and Q&A sections. */
export function splitTranscriptSections(text: string): { remarks: string; qa: string } {
  const qaMarkerRegex = /\b(question[s]?\s*and\s*answer[s]?|q\s*[&\/]\s*a|q&a session|operator:|questions from|analyst questions)\b/i;
  const idx = text.search(qaMarkerRegex);
  if (idx === -1) {
    return { remarks: text, qa: '' };
  }
  return { remarks: text.slice(0, idx), qa: text.slice(idx) };
}

/** Parse EDGAR Atom XML feed to get filing index URLs. */
export function parseEdgarAtomFeed(xml: string): Array<{ url: string; date: string; title: string }> {
  const entries: Array<{ url: string; date: string; title: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);
    const dateMatch = entry.match(/<updated>([^<]+)<\/updated>/i);
    const titleMatch = entry.match(/<title[^>]*>([^<]+)<\/title>/i);

    if (linkMatch) {
      entries.push({
        url: linkMatch[1].trim(),
        date: dateMatch ? dateMatch[1].trim() : '',
        title: titleMatch ? titleMatch[1].trim() : '',
      });
    }
  }
  return entries;
}

/** Fetch the filing index page and find the primary HTM exhibit. */
async function findTranscriptUrl(indexUrl: string): Promise<string | null> {
  try {
    const res = await fetch(indexUrl, {
      headers: { 'User-Agent': 'Dexter/1.0 research@dexter.ai' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for ex99 or an HTM file with keywords in filename
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const rowText = stripHtml(row).toLowerCase();
      if (
        rowText.includes('ex-99') ||
        rowText.includes('exhibit 99') ||
        rowText.includes('transcript') ||
        rowText.includes('earnings')
      ) {
        const hrefMatch = row.match(/href="([^"]+\.htm[l]?)"/i);
        if (hrefMatch) {
          const path = hrefMatch[1];
          return path.startsWith('http') ? path : `https://www.sec.gov${path}`;
        }
      }
      // Suppress unused variable warning
      void cells;
    }

    // Fallback: first .htm link in table
    const fallback = html.match(/href="(\/Archives\/edgar\/data\/[^"]+\.htm[l]?)"/i);
    if (fallback) return `https://www.sec.gov${fallback[1]}`;
  } catch {
    // Ignore fetch errors
  }
  return null;
}

/** Extract the first N analyst Q&A pairs from Q&A text. */
export function extractQaHighlights(qaText: string, count = 3): Array<{ question: string; answer: string }> {
  const highlights: Array<{ question: string; answer: string }> = [];
  // Split on "Analyst:" or "Q:" type markers
  const questionRegex = /(?:analyst|questioner|q\s*:|question\s*:)/gi;
  const parts = qaText.split(questionRegex);

  for (let i = 1; i <= Math.min(count, parts.length - 1); i++) {
    const segment = parts[i].trim();
    const answerIdx = segment.search(/(?:answer|a\s*:|ceo|cfo|president|executive|response)/i);
    const question = (answerIdx > 0 ? segment.slice(0, answerIdx) : segment.slice(0, 300)).trim().slice(0, 200);
    const answer = (answerIdx > 0 ? segment.slice(answerIdx) : '').trim().slice(0, 200);
    if (question.length > 10) {
      highlights.push({ question, answer });
    }
  }
  return highlights;
}

export const getEarningsTranscript = new DynamicStructuredTool({
  name: 'get_earnings_transcript',
  description:
    'Fetches earnings call transcripts for a stock from SEC EDGAR 8-K filings. Returns management prepared remarks, forward guidance statements, and Q&A highlights.',
  schema: EarningsTranscriptInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();

    try {
      // Build date range: last 30 days back, today
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const todayStr = today.toISOString().split('T')[0];
      const startStr = thirtyDaysAgo.toISOString().split('T')[0];

      // Fetch EDGAR 8-K Atom feed for company
      const atomUrl =
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}` +
        `&type=8-K&dateb=&owner=include&count=5&output=atom`;

      const atomRes = await fetch(atomUrl, {
        headers: { 'User-Agent': 'Dexter/1.0 research@dexter.ai' },
      });

      if (!atomRes.ok) {
        throw new Error(`EDGAR returned ${atomRes.status} for ${ticker}`);
      }

      const atomXml = await atomRes.text();
      const filings = parseEdgarAtomFeed(atomXml);

      if (filings.length === 0) {
        throw new Error(`No 8-K filings found for ${ticker} on EDGAR`);
      }

      // Filter by quarter if requested
      let targetFiling = filings[0];
      if (input.quarter) {
        const qMatch = input.quarter.match(/Q([1-4])\s*(\d{4})/i);
        if (qMatch) {
          const qNum = parseInt(qMatch[1]);
          const year = parseInt(qMatch[2]);
          // Map quarter to approximate month range
          const qMonths: Record<number, [number, number]> = {
            1: [1, 3],
            2: [4, 6],
            3: [7, 9],
            4: [10, 12],
          };
          const [startMonth, endMonth] = qMonths[qNum] || [1, 12];
          const found = filings.find((f) => {
            const d = new Date(f.date);
            const m = d.getMonth() + 1;
            return d.getFullYear() === year && m >= startMonth && m <= endMonth;
          });
          if (found) targetFiling = found;
        }
      }

      // Convert filing entry URL to index page URL if needed
      let indexUrl = targetFiling.url;
      if (!indexUrl.includes('/Archives/')) {
        // May already be an index URL; convert Atom filing link to index format
        const cidxMatch = indexUrl.match(/CIK=(\d+).*accession-number=([\d-]+)/i);
        if (cidxMatch) {
          const cik = cidxMatch[1];
          const accession = cidxMatch[2].replace(/-/g, '');
          indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${accession}-index.htm`;
        }
      }

      const transcriptUrl = await findTranscriptUrl(indexUrl);
      if (!transcriptUrl) {
        throw new Error(`Could not find transcript exhibit in filing for ${ticker}`);
      }

      const transcriptRes = await fetch(transcriptUrl, {
        headers: { 'User-Agent': 'Dexter/1.0 research@dexter.ai' },
      });
      if (!transcriptRes.ok) {
        throw new Error(`Failed to fetch transcript: ${transcriptRes.status}`);
      }

      const rawHtml = await transcriptRes.text();
      const text = stripHtml(rawHtml);

      const { remarks, qa } = splitTranscriptSections(text);
      const guidancePhrases = extractGuidancePhrases(text);
      const qaHighlights = extractQaHighlights(qa);

      const filingDate = targetFiling.date ? targetFiling.date.split('T')[0] : todayStr;

      // Infer quarter from filing date
      const filingDateObj = new Date(filingDate);
      const quarterNum = Math.ceil((filingDateObj.getMonth() + 1) / 3);
      const inferredQuarter = `Q${quarterNum} ${filingDateObj.getFullYear()}`;

      const result = {
        ticker,
        filingDate,
        inferredQuarter,
        filingTitle: targetFiling.title,
        preparedRemarksSummary: remarks.slice(0, 800),
        guidancePhrases,
        qaHighlights,
        fullFilingUrl: transcriptUrl,
        edgarFilingUrl: indexUrl,
        dateRange: { startdt: startStr, enddt: todayStr },
      };

      return formatToolResult(result, [transcriptUrl, indexUrl]);
    } catch (primaryError) {
      // Fall back to Tavily web search
      if (process.env.TAVILY_API_KEY) {
        try {
          const year = new Date().getFullYear();
          const q = input.quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${year}`;
          return await tavilySearch.invoke({
            query: `${ticker} earnings call transcript ${q} management prepared remarks guidance`,
          });
        } catch {
          // Tavily also failed
        }
      }

      const errorMessage =
        primaryError instanceof Error ? primaryError.message : 'Unknown error';
      return formatToolResult(
        {
          error: `Earnings transcript unavailable for ${ticker}: ${errorMessage}. Try web_search for "${ticker} earnings call transcript".`,
        },
        [],
      );
    }
  },
});
