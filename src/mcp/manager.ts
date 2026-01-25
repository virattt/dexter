import type { StructuredToolInterface } from '@langchain/core/tools';
import { MCPClient } from './client.js';
import { loadMCPConfig, getEnabledServers } from './config.js';
import { mcpToolToLangChain } from './converter.js';
import type { MCPServerConfig, MCPServerState } from './types.js';

/**
 * MCPManager - Singleton managing all MCP server connections
 * Handles lifecycle of MCP clients and tool aggregation
 */
export class MCPManager {
  private static instance: MCPManager | null = null;

  private clients: Map<string, MCPClient> = new Map();
  private serverStates: Map<string, MCPServerState> = new Map();
  private tools: StructuredToolInterface[] = [];
  private initialized = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (MCPManager.instance) {
      MCPManager.instance.shutdown().catch(() => {});
      MCPManager.instance = null;
    }
  }

  /**
   * Initialize connections to all enabled MCP servers
   * Uses graceful degradation: failed servers don't block agent startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const config = loadMCPConfig();
    const enabledServers = getEnabledServers(config);

    const serverCount = Object.keys(enabledServers).length;
    if (serverCount === 0) {
      this.initialized = true;
      return;
    }

    console.error(`[MCP] Connecting to ${serverCount} server(s)...`);

    // Connect to each enabled server
    const connectionPromises = Object.entries(enabledServers).map(
      ([name, serverConfig]) => this.connectServer(name, serverConfig)
    );

    await Promise.all(connectionPromises);

    const connectedCount = Array.from(this.serverStates.values()).filter(s => s.connected).length;
    console.error(`[MCP] Connected: ${connectedCount}/${serverCount} servers, ${this.tools.length} tools available`);

    this.initialized = true;
  }

  /**
   * Connect to a single MCP server
   * Errors are logged but don't propagate (graceful degradation)
   */
  private async connectServer(name: string, config: MCPServerConfig): Promise<void> {
    const state: MCPServerState = {
      name,
      config,
      connected: false,
    };

    try {
      const client = new MCPClient(name, config);
      await client.connect();

      // Get tools from the server
      const mcpTools = await client.getTools();

      // Convert to LangChain tools
      const langchainTools = mcpTools.map(tool =>
        mcpToolToLangChain(name, tool, client)
      );

      this.clients.set(name, client);
      this.tools.push(...langchainTools);

      state.connected = true;
      this.serverStates.set(name, state);

      const toolNames = mcpTools.map(t => t.name).join(', ');
      console.error(`[MCP] ✓ ${name}: ${mcpTools.length} tools (${toolNames})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.error = errorMessage;
      this.serverStates.set(name, state);

      // Log error but don't throw - graceful degradation
      console.error(`[MCP] Failed to connect to server '${name}': ${errorMessage}`);
    }
  }

  /**
   * Get all MCP tools as LangChain StructuredToolInterface
   */
  getTools(): StructuredToolInterface[] {
    return this.tools;
  }

  /**
   * Get the state of all configured servers
   */
  getServerStates(): MCPServerState[] {
    return Array.from(this.serverStates.values());
  }

  /**
   * Check if a specific server is connected
   */
  isServerConnected(name: string): boolean {
    return this.serverStates.get(name)?.connected ?? false;
  }

  /**
   * Graceful shutdown of all MCP connections
   */
  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(
      client => client.disconnect().catch(() => {})
    );

    await Promise.all(disconnectPromises);

    this.clients.clear();
    this.serverStates.clear();
    this.tools = [];
    this.initialized = false;
  }
}

/**
 * Initialize MCP and return the manager instance
 * Convenience function for agent integration
 */
export async function initializeMCP(): Promise<MCPManager> {
  const manager = MCPManager.getInstance();
  await manager.initialize();
  return manager;
}
