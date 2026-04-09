import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type { GenerateContentRequest, FunctionDeclaration } from '@google/generative-ai';
import { config } from 'dotenv';

config();

interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

interface LLMClient {
  processMessage(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[]
  ): Promise<LLMResponse>;
}

interface MCPToolSpec {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface ParsedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function getToolSpecs(tools: unknown[]): MCPToolSpec[] {
  return tools.filter((tool): tool is MCPToolSpec => typeof tool === 'object' && tool !== null);
}

function normalizeToolCalls(rawToolCalls: unknown): ParsedToolCall[] {
  if (!Array.isArray(rawToolCalls)) {
    return [];
  }

  return rawToolCalls
    .filter((toolCall) => typeof (toolCall as { name?: unknown })?.name === 'string')
    .map((toolCall, index) => {
      const call = toolCall as { id?: unknown; name?: unknown; input?: unknown };
      return {
        id:
          typeof call.id === 'string' && call.id.length > 0
            ? call.id
            : `llm-tool-${Date.now()}-${index}`,
        name: call.name as string,
        input:
          typeof call.input === 'object' && call.input !== null
            ? (call.input as Record<string, unknown>)
            : {}
      };
    });
}

function tryParseJson(raw: string): unknown | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  const withoutFence = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  if (withoutFence !== text) {
    try {
      return JSON.parse(withoutFence.trim());
    } catch {
      // noop
    }
  }

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = withoutFence.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // noop
    }
  }

  return null;
}

function extractToolCallPayload(text: string): LLMResponse | null {
  const firstParse = tryParseJson(text);
  if (!firstParse) {
    return null;
  }

  const parsed = typeof firstParse === 'string' ? tryParseJson(firstParse) : firstParse;

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const payload = parsed as { content?: unknown; toolCalls?: unknown };
  const toolCalls = normalizeToolCalls(payload.toolCalls);
  if (!toolCalls.length) {
    return null;
  }

  return {
    content: typeof payload.content === 'string' ? payload.content : '',
    toolCalls
  };
}

function parseToolAwareResponse(text: string): LLMResponse {
  const extracted = extractToolCallPayload(text);
  if (extracted) {
    return extracted;
  }

  return { content: text };
}

function buildOllamaPrompt(
  messages: Array<{ role: string; content: string }>,
  tools: unknown[]
): string {
  const toolSpecs = getToolSpecs(tools).map((tool) => ({
    name: tool.function?.name,
    description: tool.function?.description,
    parameters: tool.function?.parameters
  }));

  const history = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');

  return [
    'You are an assistant that can call tools.',
    'If tool usage is needed, output ONLY valid JSON in this format:',
    '{"content":"","toolCalls":[{"id":"call-1","name":"tool_name","input":{}}]}',
    'If no tool is needed, return normal plain text.',
    'Available tools:',
    JSON.stringify(toolSpecs, null, 2),
    'Conversation:',
    history || 'USER: '
  ].join('\n\n');
}

function normalizeFunctionInput(args: unknown): Record<string, unknown> {
  if (typeof args === 'object' && args !== null) {
    return args as Record<string, unknown>;
  }

  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // noop
    }
  }

  return {};
}

/**
 * OpenAI LLM Client
 */
class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processMessage(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[]
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: tools.length > 0 ? (tools as OpenAI.Chat.ChatCompletionTool[]) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content || '';
    const toolCalls = [];

    if (response.choices[0].message.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        if (toolCall.type === 'function') {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
      }
    }

    if (toolCalls.length === 0 && content) {
      const extracted = extractToolCallPayload(content);
      if (extracted) {
        return extracted;
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}

/**
 * Gemini LLM Client
 */
class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY for Gemini provider');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview';
  }

  async processMessage(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[]
  ): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction:
        'You are a tool-calling assistant. Use available tools when needed and return concise answers.'
    });

    const functionDeclarations: FunctionDeclaration[] = getToolSpecs(tools)
      .filter((tool) => typeof tool.function?.name === 'string')
      .map((tool) => ({
        name: tool.function!.name as string,
        ...(tool.function?.description ? { description: tool.function.description } : {}),
        ...(tool.function?.parameters
          ? { parameters: tool.function.parameters as unknown as FunctionDeclaration['parameters'] }
          : {})
      }));

    const contents = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    const request: GenerateContentRequest = {
      contents,
      generationConfig: {
        temperature: 0.7
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    };

    if (functionDeclarations.length > 0) {
      request.tools = [{ functionDeclarations }];
    }

    console.log('Gemini prompt sending...');
    const result = await model.generateContent(request);
    const response = result.response;
    console.log('Gemini raw response:', response);

    const functionCalls =
      typeof (response as { functionCalls?: () => unknown[] }).functionCalls === 'function'
        ? ((response as { functionCalls: () => unknown[] }).functionCalls() ?? [])
        : [];

    const mappedToolCalls = functionCalls
      .map((call, index) => {
        const functionCall = call as { name?: unknown; args?: unknown };
        if (typeof functionCall.name !== 'string') {
          return null;
        }

        return {
          id: `gemini-tool-${Date.now()}-${index}`,
          name: functionCall.name,
          input: normalizeFunctionInput(functionCall.args)
        };
      })
      .filter((toolCall): toolCall is ParsedToolCall => toolCall !== null);

    const content = typeof response.text === 'function' ? response.text() : '';

    if (mappedToolCalls.length > 0) {
      return {
        content,
        toolCalls: mappedToolCalls
      };
    }

    if (tools.length > 0 && content) {
      const extracted = parseToolAwareResponse(content);
      if (extracted.toolCalls?.length) {
        return extracted;
      }
    }

    return { content };
  }
}

/**
 * Ollama LLM Client
 */
class OllamaClient implements LLMClient {
  private apiUrl: string;
  private model: string;

  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL?.trim() || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL?.trim() || 'llama3';
  }

  async processMessage(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[]
  ): Promise<LLMResponse> {
    const prompt = buildOllamaPrompt(messages, tools);

    const response = await fetch(`${this.apiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { response?: unknown };
    const text = typeof data.response === 'string' ? data.response : JSON.stringify(data.response ?? '');

    if (tools.length > 0) {
      const parsed = parseToolAwareResponse(text);
      if (parsed.toolCalls?.length) {
        return parsed;
      }
    }

    return { content: text };
  }
}

/**
 * Get LLM client based on environment configuration
 */
export function getLLMClient(): LLMClient {
  const provider = process.env.LLM_PROVIDER || 'openai';

  switch (provider) {
    case 'openai':
      return new OpenAIClient();
    case 'gemini':
      return new GeminiClient();
    case 'ollama':
      return new OllamaClient();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

export { LLMClient, LLMResponse };
