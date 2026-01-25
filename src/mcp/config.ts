import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { MCPConfig, MCPServerConfig } from './types.js';

const MCP_CONFIG_FILE = '.dexter/mcp.json';

/**
 * Expand environment variables in a string
 * Supports ${VAR} and ${VAR:-default} syntax
 */
function expandEnvVar(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    // Handle ${VAR:-default} syntax
    const defaultMatch = expr.match(/^([^:]+):-(.*)$/);
    if (defaultMatch) {
      const [, varName, defaultValue] = defaultMatch;
      return process.env[varName] ?? defaultValue;
    }
    // Handle ${VAR} syntax
    return process.env[expr] ?? '';
  });
}

/**
 * Recursively expand environment variables in an object
 */
function expandEnvVars(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = expandEnvVar(value);
  }
  return result;
}

/**
 * Process a server config, expanding environment variables
 */
function processServerConfig(config: MCPServerConfig): MCPServerConfig {
  return {
    ...config,
    command: expandEnvVar(config.command),
    args: config.args?.map(expandEnvVar),
    env: config.env ? expandEnvVars(config.env) : undefined,
    cwd: config.cwd ? expandEnvVar(config.cwd) : undefined,
  };
}

/**
 * Load MCP configuration from .dexter/mcp.json
 * Expands environment variables in the config
 */
export function loadMCPConfig(): MCPConfig {
  if (!existsSync(MCP_CONFIG_FILE)) {
    return { mcpServers: {} };
  }

  try {
    const content = readFileSync(MCP_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as MCPConfig;

    // Process each server config to expand env vars
    const processedServers: Record<string, MCPServerConfig> = {};
    for (const [name, serverConfig] of Object.entries(config.mcpServers || {})) {
      processedServers[name] = processServerConfig(serverConfig);
    }

    return { mcpServers: processedServers };
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Save MCP configuration to .dexter/mcp.json
 */
export function saveMCPConfig(config: MCPConfig): boolean {
  try {
    const dir = dirname(MCP_CONFIG_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(MCP_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all enabled servers from the configuration
 * A server is enabled if enabled !== false (defaults to true)
 */
export function getEnabledServers(config: MCPConfig): Record<string, MCPServerConfig> {
  const enabled: Record<string, MCPServerConfig> = {};
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    if (serverConfig.enabled !== false) {
      enabled[name] = serverConfig;
    }
  }
  return enabled;
}
