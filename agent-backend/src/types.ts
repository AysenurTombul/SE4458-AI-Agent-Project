export interface UserMessage {
  conversationId: string;
  userId: string;
  content: string;
  timestamp: number;
  role: 'user';
  jwtToken?: string; // For authenticated tool calls
}

export interface AgentMessage {
  conversationId: string;
  userId: string;
  content: string;
  timestamp: number;
  role: 'assistant';
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}
