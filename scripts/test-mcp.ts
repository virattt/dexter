#!/usr/bin/env bun
/**
 * Test script to verify MCP integration is working
 * Run with: bun run scripts/test-mcp.ts
 */

import { loadMCPConfig, getEnabledServers, initializeMCP, MCPManager } from '../src/mcp/index.js';

async function main() {
  console.log('=== MCP Integration Test ===\n');

  // Step 1: Check config
  console.log('1. Loading MCP config from .dexter/mcp.json...');
  const config = loadMCPConfig();
  const serverCount = Object.keys(config.mcpServers).length;

  if (serverCount === 0) {
    console.log('   No MCP servers configured.');
    console.log('\n   To configure MCP servers, create .dexter/mcp.json:');
    console.log('   {');
    console.log('     "mcpServers": {');
    console.log('       "filesystem": {');
    console.log('         "command": "npx",');
    console.log('         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]');
    console.log('       }');
    console.log('     }');
    console.log('   }');
    return;
  }

  console.log(`   Found ${serverCount} server(s) configured:`);
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    const enabled = serverConfig.enabled !== false;
    console.log(`   - ${name}: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''} [${enabled ? 'enabled' : 'disabled'}]`);
  }

  // Step 2: Check enabled servers
  console.log('\n2. Checking enabled servers...');
  const enabledServers = getEnabledServers(config);
  const enabledCount = Object.keys(enabledServers).length;
  console.log(`   ${enabledCount} server(s) enabled`);

  if (enabledCount === 0) {
    console.log('   No servers enabled. Set "enabled": true or remove the enabled field.');
    return;
  }

  // Step 3: Initialize MCP and connect
  console.log('\n3. Connecting to MCP servers...');
  try {
    const manager = await initializeMCP();

    // Step 4: Check connection status
    console.log('\n4. Connection status:');
    const states = manager.getServerStates();
    for (const state of states) {
      if (state.connected) {
        console.log(`   ✓ ${state.name}: connected`);
      } else {
        console.log(`   ✗ ${state.name}: failed - ${state.error}`);
      }
    }

    // Step 5: List available tools
    const tools = manager.getTools();
    console.log(`\n5. Available MCP tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`   - ${tool.name}: ${tool.description?.slice(0, 60)}...`);
    }

    // Cleanup
    await manager.shutdown();
    MCPManager.resetInstance();

    console.log('\n=== MCP Integration Test Complete ===');
    console.log(tools.length > 0 ? '✓ MCP is working!' : '⚠ No tools loaded - check server configuration');

  } catch (error) {
    console.error('\n✗ Error during MCP initialization:', error);
  }
}

main().catch(console.error);
