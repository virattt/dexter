import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';

type McpServerConfig = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type McpToolInfo = {
  name: string;
  description?: string;
};

type McpListToolsResponse = {
  tools?: McpToolInfo[];
};

function parseMcpServers(raw: string | undefined): McpServerConfig[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is McpServerConfig => Boolean(item?.name && item?.command));
    }
  } catch {
    return [];
  }
  return [];
}

function formatMcpResult(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
    const textBlocks = content
      .filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text);
    if (textBlocks.length > 0) {
      return textBlocks.join('\n');
    }
  }
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

export async function createMcpTools(): Promise<StructuredToolInterface[]> {
  const servers = parseMcpServers(process.env.MCP_SERVERS);
  if (servers.length === 0) return [];

  const tools: StructuredToolInterface[] = [];

  for (const server of servers) {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: { ...process.env, ...(server.env ?? {}) },
    });
    const client = new Client(
      { name: `dexter-mcp-${server.name}`, version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    const response = await client.listTools();
    const toolList = (response as McpListToolsResponse).tools ?? [];

    for (const tool of toolList) {
      const toolName = `${server.name}.${tool.name}`;
      const description = tool.description
        ? `${tool.description} (via MCP: ${server.name})`
        : `MCP tool from ${server.name}`;

      tools.push(
        new DynamicStructuredTool({
          name: toolName,
          description,
          schema: z.object({}).passthrough(),
          func: async (input) => {
            const result = await client.callTool({
              name: tool.name,
              arguments: input,
            });
            return formatMcpResult(result);
          },
        })
      );
    }
  }

  return tools;
}
