import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.quartr.com';

type QueryValue = string | number | boolean | string[] | undefined;

interface ApiResponse {
  data: unknown;
  url: string;
}

function getQuartrApiKey(): string {
  const apiKey = process.env.QUARTR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('QUARTR_API_KEY is not set. Add it to .env to enable Quartr API tools.');
  }
  return apiKey;
}

function appendQuery(url: URL, params: Record<string, QueryValue>): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

async function callQuartrApi(
  path: string,
  params: Record<string, QueryValue>
): Promise<ApiResponse> {
  const apiKey = getQuartrApiKey();
  const url = new URL(path, BASE_URL);
  appendQuery(url, params);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Quartr API] network error: ${path} — ${message}`);
    throw new Error(`[Quartr API] request failed for ${path}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Quartr API] error: ${path} — ${detail}`);
    throw new Error(`[Quartr API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Quartr API] parse error: ${path} — ${detail}`);
    throw new Error(`[Quartr API] request failed: ${detail}`);
  });

  return { data, url: url.toString() };
}

const QuartrParamSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const QuartrDataInputSchema = z.object({
  resource: z
    .enum(['companies', 'events', 'reports', 'transcripts'])
    .describe("Quartr v3 resource to query: companies, events, reports, or transcripts."),
  id: z
    .string()
    .optional()
    .describe(
      'Optional resource identifier. If provided, calls the detail endpoint /v3/{resource}/{id}.'
    ),
  params: z
    .record(z.string(), QuartrParamSchema)
    .optional()
    .describe(
      'Optional query parameters passed directly to Quartr. Use this for pagination/filtering fields like cursor, limit, companyIds, etc.'
    ),
});

export const getQuartrData = new DynamicStructuredTool({
  name: 'get_quartr_data',
  description:
    'Queries Quartr Public API v3 datasets (companies, events, reports, transcripts). Supports list and detail endpoints via resource + optional id.',
  schema: QuartrDataInputSchema,
  func: async (input) => {
    const path = input.id
      ? `/v3/${input.resource}/${encodeURIComponent(input.id)}`
      : `/v3/${input.resource}`;
    const { data, url } = await callQuartrApi(path, input.params ?? {});
    return formatToolResult(data, [url]);
  },
});

