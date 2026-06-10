/**
 * web_fetch tool — fetches a URL, converts it to markdown, and applies a
 * prompt to the content using a small, fast model.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { WEB_FETCH_DESCRIPTION, WEB_FETCH_TOOL_NAME } from './prompt.js';
import {
  applyPromptToMarkdown,
  type FetchedContent,
  getURLMarkdownContent,
} from './utils.js';

export { WEB_FETCH_DESCRIPTION } from './prompt.js';

const WebFetchInputSchema = z.object({
  url: z.string().describe('The URL to fetch content from'),
  prompt: z.string().describe('The prompt to run on the fetched content'),
});

type WebFetchOutput = {
  bytes: number;
  code: number;
  codeText: string;
  result: string;
  durationMs: number;
  url: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create a web_fetch tool configured with the given model. The model is used
 * to derive the fast variant that processes fetched content.
 */
export function createWebFetch(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: WEB_FETCH_TOOL_NAME,
    description:
      'Fetch content from a URL, convert it to markdown, and answer a prompt about it using a fast model.',
    schema: WebFetchInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const start = Date.now();
      const { url, prompt } = input;

      // Link the tool's abort controller to any signal provided by the runtime.
      const abortController = new AbortController();
      const externalSignal = config?.signal;
      if (externalSignal) {
        if (externalSignal.aborted) {
          abortController.abort();
        } else {
          externalSignal.addEventListener('abort', () => abortController.abort(), { once: true });
        }
      }

      try {
        const response = await getURLMarkdownContent(url, abortController);

        // Cross-host redirect: tell the model to re-fetch the redirect target.
        if ('type' in response && response.type === 'redirect') {
          const statusText =
            response.statusCode === 301
              ? 'Moved Permanently'
              : response.statusCode === 308
                ? 'Permanent Redirect'
                : response.statusCode === 307
                  ? 'Temporary Redirect'
                  : 'Found';

          const message = `REDIRECT DETECTED: The URL redirects to a different host.

Original URL: ${response.originalUrl}
Redirect URL: ${response.redirectUrl}
Status: ${response.statusCode} ${statusText}

To complete your request, make a new web_fetch request with these parameters:
- url: "${response.redirectUrl}"
- prompt: "${prompt}"`;

          const output: WebFetchOutput = {
            bytes: Buffer.byteLength(message),
            code: response.statusCode,
            codeText: statusText,
            result: message,
            durationMs: Date.now() - start,
            url,
          };
          return formatToolResult(output, [url]);
        }

        const { content, bytes, code, codeText, contentType, persistedPath, persistedSize } =
          response as FetchedContent;

        let result = await applyPromptToMarkdown(prompt, content, abortController.signal, model);

        // Note any binary file that was additionally saved to disk.
        if (persistedPath) {
          result += `\n\n[Binary content (${contentType}, ${formatFileSize(
            persistedSize ?? bytes,
          )}) also saved to ${persistedPath}]`;
        }

        const output: WebFetchOutput = {
          bytes,
          code,
          codeText,
          result,
          durationMs: Date.now() - start,
          url,
        };
        return formatToolResult(output, [url]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: `[web_fetch] ${message}`, url }, [url]);
      }
    },
  });
}
