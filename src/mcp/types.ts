/**
 * MCP Server Configuration
 * Defines how to connect to and run an MCP server
 */
export interface MCPServerConfig {
  /** Command to execute (e.g., "npx", "node") */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Working directory for the server process */
  cwd?: string;
  /** Whether the server is enabled (defaults to true) */
  enabled?: boolean;
}

/**
 * Root MCP configuration structure
 * Stored in .dexter/mcp.json
 */
export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Runtime state for a connected MCP server
 */
export interface MCPServerState {
  name: string;
  config: MCPServerConfig;
  connected: boolean;
  error?: string;
}

/**
 * Tool definition from an MCP server
 * Based on the MCP protocol tool structure
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}
