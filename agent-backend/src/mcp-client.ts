import { config } from 'dotenv';
config();

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Client for communicating with the MCP Server
 * Uses MCP SDK stdio transport configured via MCP_SERVER_BIN and MCP_SERVER_ARGS
 */
export class MCPClient {
  private client: Client;
  private transport?: StdioClientTransport;
  private tools: MCPTool[] = [];

  constructor() {
    this.client = new Client(
      {
        name: 'listing-agent-backend',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
  }

  private parseMcpArgs(raw?: string): string[] {
    if (!raw) {
      return ['tsx', '../mcp-server/src/index.ts'];
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((arg) => typeof arg === 'string')) {
        return parsed;
      }
    } catch {
      return raw
        .split(' ')
        .map((arg) => arg.trim())
        .filter(Boolean);
    }

    throw new Error('MCP_SERVER_ARGS must be a JSON string array or space-separated string');
  }

  /**
   * Initialize and connect to MCP Server
   */
  async initialize(): Promise<void> {
    const mcpBin = process.env.MCP_SERVER_BIN || 'npx';
    const mcpArgs = this.parseMcpArgs(process.env.MCP_SERVER_ARGS);

    this.transport = new StdioClientTransport({
      command: mcpBin,
      args: mcpArgs,
      stderr: 'pipe'
    });

    await this.client.connect(this.transport);
    await this.loadTools();

    if (this.transport.stderr) {
      this.transport.stderr.on('data', (data: Buffer) => {
        console.log(`[MCP Server] ${data.toString()}`);
      });
    }
  }

  /**
   * Get the list of available tools from MCP Server
   */
  private async loadTools(): Promise<void> {
    try {
      const response = await this.client.listTools();
      this.tools = response.tools as MCPTool[];
      console.log(`Loaded ${this.tools.length} MCP tools over stdio`);
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
      throw error;
    }
  }

  /**
   * Execute a tool through the MCP Server
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    token?: string
  ): Promise<unknown> {
    if (!this.transport) {
      throw new Error('MCP Server is not initialized');
    }

    const response = (await this.client.callTool({
      name: toolName,
      arguments: token ? { ...input, _token: token } : input
    })) as {
      isError?: boolean;
      content?: Array<{ type?: string; text?: string }>;
    };

    if (response.isError) {
      const text = response.content?.[0]?.text
        ? String(response.content[0].text)
        : 'Unknown MCP tool error';
      throw new Error(text);
    }

    const textContent = response.content?.find((item) => item.type === 'text');

    if (!textContent?.text) {
      return response;
    }

    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }

  /**
   * Get available tools metadata
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Shutdown MCP Server connection
   */
  async shutdown(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      this.transport = undefined;
    }
  }
}
export default MCPClient;
