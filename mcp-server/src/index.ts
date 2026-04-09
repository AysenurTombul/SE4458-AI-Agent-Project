import { config } from 'dotenv';
config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { tools, executeTool } from './tools.js';
import { ToolInput } from './types.js';

// Create MCP server [cite: 78, 87]
const server = new Server({
  name: 'listing-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

/**
 * List available tools [cite: 79]
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

/**
 * Handle tool calls from MCP clients [cite: 79, 80]
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const toolArgs = (args ?? {}) as Record<string, unknown>;
    const token = typeof toolArgs._token === 'string' ? toolArgs._token : undefined;
    const result = await executeTool(name, toolArgs as ToolInput, token);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the MCP server [cite: 99]
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Listing MCP server started successfully');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});