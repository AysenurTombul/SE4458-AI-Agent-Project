export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result?: unknown;
  error?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  capacity: number;
  country: string;
  city: string;
  price: number;
  amenities: string[];
  ratingAverage: number;
  ratingCount: number;
}
