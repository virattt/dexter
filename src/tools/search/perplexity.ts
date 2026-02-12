import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { formatToolResult, parseSearchResults } from "../types.js";
import { logger } from "../../utils/logger.js";

// Lazily initialized to avoid errors when API key is not set
let perplexityClient: any = null;

async function getPerplexityClient() {
  if (!perplexityClient) {
    const { Perplexity } = await import("@perplexity-ai/perplexity_ai");
    perplexityClient = new Perplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
    });
  }
  return perplexityClient;
}

export const perplexitySearch = new DynamicStructuredTool({
  name: "web_search",
  description:
    "Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.",
  schema: z.object({
    query: z.string().describe("The search query to look up on the web"),
  }),
  func: async (input) => {
    try {
      const client = await getPerplexityClient();
      const response = await client.search.create({
        query: input.query,
        max_results: 5,
        max_tokens_per_page: 4096,
      });

      // Transform Perplexity response to match our expected format
      const results = response.results.map((result: any) => ({
        content: `${result.title}\n\n${result.snippet}`,
        url: result.url,
      }));

      const formattedResult = results
        .map((r: any, i: number) => `[${i + 1}] ${r.url}\n${r.content}`)
        .join("\n\n");

      const urls = results.map((r: any) => r.url);

      return formatToolResult(formattedResult, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Perplexity API] error: ${message}`);
      throw new Error(`[Perplexity API] ${message}`);
    }
  },
});
