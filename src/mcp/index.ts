// MCP (Model Context Protocol) support for Dexter
// Enables connection to external MCP servers and using their tools

export type {
  MCPServerConfig,
  MCPConfig,
  MCPServerState,
  MCPToolDefinition,
} from './types.js';

export {
  loadMCPConfig,
  saveMCPConfig,
  getEnabledServers,
} from './config.js';

export { MCPClient } from './client.js';

export {
  jsonSchemaToZod,
  mcpToolToLangChain,
} from './converter.js';

export {
  MCPManager,
  initializeMCP,
} from './manager.js';
