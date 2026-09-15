#!/usr/bin/env node
/**
 * Downlodr MCP Server
 *
 * Connects Claude to the Downlodr Electron app via the local HTTP bridge.
 * Run this as the MCP server command in claude_desktop_config.json or
 * Claude Code settings.json.
 *
 * Downlodr must be running for tools to work.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadToken } from './client.js';
import { registerDownloadTools } from './tools/downloads.js';
import { registerSubscriptionTools } from './tools/subscriptions.js';
import { registerTranscriptTools } from './tools/transcripts.js';
import { registerAfdaTools } from './tools/afda.js';
import { registerSystemTools } from './tools/system.js';
import { registerWorkflowTools } from './tools/workflows.js';
import { buildCli } from './cli.js';

async function main() {
  // CLI mode: any argument after the binary name triggers the CLI instead of MCP server
  if (process.argv.length > 2) {
    try {
      loadToken();
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }
    const cli = buildCli();
    await cli.parseAsync(process.argv);
    return;
  }

  // MCP server mode (no args — invoked by Claude)
  try {
    loadToken();
  } catch (err) {
    process.stderr.write(`[downlodr-mcp] ${(err as Error).message}\n`);
    process.exit(1);
  }

  const server = new McpServer({
    name: 'downlodr',
    version: '1.0.0',
  });

  registerWorkflowTools(server);
  registerSystemTools(server);
  registerDownloadTools(server);
  registerSubscriptionTools(server);
  registerTranscriptTools(server);
  registerAfdaTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[downlodr-mcp] Server running. Waiting for Claude...\n');
}

main().catch((err) => {
  process.stderr.write(`[downlodr-mcp] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
