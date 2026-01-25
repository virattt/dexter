import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPToolDefinition } from './types.js';

/**
 * MCP Client wrapper for connecting to MCP servers via stdio
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private serverName: string;
  private config: MCPServerConfig;
  private _connected = false;

  constructor(serverName: string, config: MCPServerConfig) {
    this.serverName = serverName;
    this.config = config;
    this.client = new Client(
      { name: 'dexter', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this._connected) return;

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env ? { ...process.env, ...this.config.env } as Record<string, string> : undefined,
      cwd: this.config.cwd,
      stderr: 'pipe', // Capture stderr for debugging
    });

    await this.client.connect(this.transport);
    this._connected = true;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this._connected) return;

    try {
      await this.client.close();
    } catch {
      // Ignore close errors
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore transport close errors
      }
      this.transport = null;
    }

    this._connected = false;
  }

  /**
   * Check if connected to the server
   */
  get connected(): boolean {
    return this._connected;
  }

  /**
   * Get the server name
   */
  get name(): string {
    return this.serverName;
  }

  /**
   * Get available tools from the MCP server
   */
  async getTools(): Promise<MCPToolDefinition[]> {
    if (!this._connected) {
      throw new Error(`Not connected to MCP server: ${this.serverName}`);
    }

    const result = await this.client.listTools();
    return result.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPToolDefinition['inputSchema'],
    }));
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this._connected) {
      throw new Error(`Not connected to MCP server: ${this.serverName}`);
    }

    const result = await this.client.callTool({ name, arguments: args });

    // Handle different result formats
    if ('toolResult' in result) {
      return result.toolResult;
    }

    // Extract content from the result
    if ('content' in result && Array.isArray(result.content)) {
      // Combine text content
      const textParts = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text);

      if (textParts.length > 0) {
        return textParts.join('\n');
      }

      // Return structured content if available
      if (result.structuredContent) {
        return result.structuredContent;
      }

      // Return full content array if mixed types
      return result.content;
    }

    return result;
  }
}
