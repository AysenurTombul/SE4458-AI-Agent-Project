import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

config();

import firestoreService from './firestore.js';
import { getLLMClient } from './llm';
import MCPClient from './mcp-client.js';
import { UserMessage, AgentMessage } from './types.js';

const app: Express = express();
const httpServer = http.createServer(app);
const frontendOrigin = 'http://localhost:3000';
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: frontendOrigin,
    credentials: true
  }
});

const DEFAULT_PORT = 5001;
const parsedPort = Number(process.env.PORT ?? DEFAULT_PORT);
const initialPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

async function listenOnAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  let portToTry = startPort;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
          httpServer.off('listening', onListening);
          reject(error);
        };

        const onListening = () => {
          httpServer.off('error', onError);
          resolve();
        };

        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(portToTry);
      });

      return portToTry;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      const isPortInUse = nodeError.code === 'EADDRINUSE';

      if (!isPortInUse) {
        throw error;
      }

      console.warn(`[Agent Backend] Port ${portToTry} is already in use. Trying ${portToTry + 1}...`);
      portToTry += 1;
    }
  }

  throw new Error(
    `[Agent Backend] Could not find an available port after ${maxAttempts} attempts, starting at ${startPort}.`
  );
}

// Middleware
app.use(express.json());
app.use(cors());

// Initialize clients
const llmClient = getLLMClient();
const mcpClient = new MCPClient();

// Store active socket connections mapped by userId
const activeConnections: Map<string, string> = new Map();
type ConversationContext = {
  lastListings: Array<{ id: string; title: string }>;
  lastSearch?: {
    startDate?: string;
    endDate?: string;
    people?: number;
  };
};

const conversationContextStore: Map<string, ConversationContext> = new Map();

const DEMO_GUEST_ID = '2df2ce47-1f43-4f82-8fcb-21bfd46275ec';
const DEMO_GUEST_NAME = 'Ayşenur Tombul';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Authentication middleware (basic token validation)
 * In production, integrate with your actual auth system
 */
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const jwtToken = req.headers['authorization']?.split(' ')[1];

  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }

  (req as any).userId = userId;
  (req as any).jwtToken = jwtToken;
  next();
};

app.use(authenticateUser);

/**
 * REST Endpoints
 */

// Get all conversations for user
app.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversations = await firestoreService.getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create new conversation
app.post('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const conversationId = await firestoreService.createConversation(userId, title);
    res.status(201).json({ id: conversationId, title, userId });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get conversation history
app.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id as string;

    const conversation = await firestoreService.getConversation(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Delete conversation
app.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id as string;

    await firestoreService.deleteConversation(conversationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * WebSocket Events for Real-time Chat
 */

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId as string;

  if (!userId) {
    socket.disconnect();
    return;
  }

  activeConnections.set(userId, socket.id);
  console.log(`User ${userId} connected with socket ${socket.id}`);

  // Receive message from client
  socket.on('send_message', async (data: UserMessage) => {
    try {
      const { conversationId, content, jwtToken } = data;

      // Save user message to Firestore
      await firestoreService.saveMessage(conversationId, userId, {
        role: 'user',
        content
      });

      // Only notify for UI update
      socket.emit('message_saved', { role: 'user', content });

      // Process message through LLM and MCP
      await processLLMRequest(socket, conversationId, userId, content, jwtToken);
    } catch (error) {
      console.error('Error processing user message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while processing your message';
      socket.emit('error', { message: errorMessage });
    }
  });

  // Load conversation for the user
  socket.on('load_conversation', async (conversationId: string) => {
    try {
      const conversation = await firestoreService.getConversation(conversationId, userId);
      socket.emit('conversation_loaded', conversation);
    } catch (error) {
      console.error('Error loading conversation:', error);
      socket.emit('error', { message: 'Failed to load conversation' });
    }
  });

  socket.on('disconnect', () => {
    activeConnections.delete(userId);
    console.log(`User ${userId} disconnected`);
  });
});

function parseOllamaJsonContent(rawContent: string): {
  content?: string;
  toolCalls?: Array<{ id?: string; name?: string; input?: Record<string, unknown> }>;
} | null {
  if (!rawContent || typeof rawContent !== 'string') {
    return null;
  }

  const text = rawContent.trim();
  if (!text) {
    return null;
  }

  const normalizeParsedPayload = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as {
      content?: unknown;
      toolCalls?: unknown;
      tool_calls?: unknown;
      name?: unknown;
      input?: unknown;
      arguments?: unknown;
      args?: unknown;
    };

    const rawToolCalls =
      Array.isArray(data.toolCalls)
        ? data.toolCalls
        : Array.isArray(data.tool_calls)
          ? data.tool_calls
          : undefined;

    if (rawToolCalls) {
      const normalized = rawToolCalls
        .map((call, index) => {
          if (!call || typeof call !== 'object') {
            return null;
          }

          const c = call as {
            id?: unknown;
            name?: unknown;
            input?: unknown;
            arguments?: unknown;
            args?: unknown;
            function?: { name?: unknown; arguments?: unknown; args?: unknown; input?: unknown };
          };

          const fnName =
            typeof c.name === 'string'
              ? c.name
              : typeof c.function?.name === 'string'
                ? c.function.name
                : undefined;

          if (!fnName) {
            return null;
          }

          const rawInput =
            c.input ?? c.arguments ?? c.args ?? c.function?.input ?? c.function?.arguments ?? c.function?.args;

          let input: Record<string, unknown> = {};
          if (rawInput && typeof rawInput === 'object') {
            input = rawInput as Record<string, unknown>;
          } else if (typeof rawInput === 'string') {
            try {
              const parsedArgs = JSON.parse(rawInput);
              if (parsedArgs && typeof parsedArgs === 'object') {
                input = parsedArgs as Record<string, unknown>;
              }
            } catch {
              input = {};
            }
          }

          return {
            id: typeof c.id === 'string' ? c.id : `ollama-tool-${Date.now()}-${index}`,
            name: fnName,
            input
          };
        })
        .filter((item): item is { id: string; name: string; input: Record<string, unknown> } => item !== null);

      if (normalized.length > 0) {
        return {
          content: typeof data.content === 'string' ? data.content : undefined,
          toolCalls: normalized
        };
      }
    }

    if (typeof data.name === 'string') {
      const rawInput = data.input ?? data.arguments ?? data.args;
      let input: Record<string, unknown> = {};
      if (rawInput && typeof rawInput === 'object') {
        input = rawInput as Record<string, unknown>;
      } else if (typeof rawInput === 'string') {
        try {
          const parsedArgs = JSON.parse(rawInput);
          if (parsedArgs && typeof parsedArgs === 'object') {
            input = parsedArgs as Record<string, unknown>;
          }
        } catch {
          input = {};
        }
      }

      return {
        content: typeof data.content === 'string' ? data.content : undefined,
        toolCalls: [
          {
            id: `ollama-tool-${Date.now()}-0`,
            name: data.name,
            input
          }
        ]
      };
    }

    return {
      content: typeof data.content === 'string' ? data.content : undefined
    };
  };

  const tryParse = (candidate: string) => {
    try {
      return normalizeParsedPayload(JSON.parse(candidate));
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) {
    return direct;
  }

  const unfenced = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (unfenced !== text) {
    const parsedUnfenced = tryParse(unfenced);
    if (parsedUnfenced) {
      return parsedUnfenced;
    }
  }

  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const embedded = tryParse(unfenced.slice(start, end + 1));
    if (embedded) {
      return embedded;
    }
  }

  return null;
}

function extractToolCallsFromMixedContent(rawContent: string): {
  content?: string;
  toolCalls?: Array<{ id?: string; name?: string; input?: Record<string, unknown> }>;
} | null {
  if (!rawContent || typeof rawContent !== 'string') {
    return null;
  }

  const direct = parseOllamaJsonContent(rawContent);
  if (direct?.toolCalls?.length) {
    return direct;
  }

  const text = rawContent.trim();
  if (!text) {
    return null;
  }

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') {
      continue;
    }

    let depth = 0;
    for (let end = start; end < text.length; end += 1) {
      const char = text[end];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }

      if (depth === 0) {
        const candidate = text.slice(start, end + 1);
        const parsed = parseOllamaJsonContent(candidate);
        if (parsed?.toolCalls?.length) {
          return parsed;
        }
        break;
      }

      if (depth < 0) {
        break;
      }
    }
  }

  return null;
}

function extractCleanAssistantText(rawContent: string): string {
  const parsed = parseOllamaJsonContent(rawContent);
  if (parsed && typeof parsed.content === 'string') {
    return parsed.content;
  }
  return rawContent;
}

function getConversationContext(conversationId: string) {
  if (!conversationContextStore.has(conversationId)) {
    conversationContextStore.set(conversationId, { lastListings: [], lastSearch: {} });
  }
  return conversationContextStore.get(conversationId)!;
}

function updateContextFromToolResult(
  conversationId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  result: unknown
) {
  const context = getConversationContext(conversationId);

  if (toolName === 'query_listings') {
    if (typeof toolInput.startDate === 'string') {
      context.lastSearch = {
        ...(context.lastSearch || {}),
        startDate: toolInput.startDate
      };
    }
    if (typeof toolInput.endDate === 'string') {
      context.lastSearch = {
        ...(context.lastSearch || {}),
        endDate: toolInput.endDate
      };
    }
    if (typeof toolInput.people === 'number') {
      context.lastSearch = {
        ...(context.lastSearch || {}),
        people: toolInput.people
      };
    }

    if (!result || typeof result !== 'object') {
      return;
    }

    const payload = result as { items?: unknown };
    if (!Array.isArray(payload.items)) {
      return;
    }

    const listings = payload.items
      .map((item) => {
        const listing = item as { id?: unknown; title?: unknown };
        if (typeof listing.id !== 'string' || typeof listing.title !== 'string') {
          return null;
        }
        return { id: listing.id, title: listing.title };
      })
      .filter((item): item is { id: string; title: string } => item !== null);

    if (listings.length > 0) {
      context.lastListings = listings;
    }
  }
}

function parseRelativeBookingDates(userMessage: string): { startDate?: string; endDate?: string } {
  const lower = userMessage.toLowerCase();
  const now = new Date();

  const toIso = (date: Date) => date.toISOString().slice(0, 10);

  if (lower.includes('next weekend')) {
    const day = now.getDay();
    const daysUntilNextSaturday = ((6 - day + 7) % 7) + 7;
    const start = new Date(now);
    start.setDate(now.getDate() + daysUntilNextSaturday);

    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    return { startDate: toIso(start), endDate: toIso(end) };
  }

  if (lower.includes('this weekend')) {
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() + daysUntilSaturday);

    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    return { startDate: toIso(start), endDate: toIso(end) };
  }

  return {};
}

function resolveListingIdFromContext(
  input: Record<string, unknown>,
  userMessage: string,
  context: { lastListings: Array<{ id: string; title: string }> }
): string | undefined {
  const directId = input.listingId;
  if (typeof directId === 'string' && UUID_REGEX.test(directId)) {
    return directId;
  }

  if (!context.lastListings.length) {
    return undefined;
  }

  const lower = userMessage.toLocaleLowerCase('tr-TR');

  if (
    lower.includes('first') ||
    lower.includes('1st') ||
    lower.includes('ilk') ||
    lower.includes('ilki') ||
    lower.includes('birinci')
  ) {
    return context.lastListings[0]?.id;
  }
  if (
    lower.includes('second') ||
    lower.includes('2nd') ||
    lower.includes('ikinci') ||
    lower.includes('ikincisi')
  ) {
    return context.lastListings[1]?.id;
  }
  if (
    lower.includes('third') ||
    lower.includes('3rd') ||
    lower.includes('üçüncü') ||
    lower.includes('ucuncu')
  ) {
    return context.lastListings[2]?.id;
  }
  if (
    lower.includes('this place') ||
    lower.includes('that place') ||
    lower.includes('this one') ||
    lower.includes('bu yer') ||
    lower.includes('bu ilan') ||
    lower.includes('şu ilan') ||
    lower.includes('su ilan') ||
    lower.includes('burası') ||
    lower.includes('burasi')
  ) {
    return context.lastListings[0]?.id;
  }

  const inputNameCandidates = [input.listingName, input.title, input.name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  for (const listing of context.lastListings) {
    const listingLower = listing.title.toLowerCase();
    if (lower.includes(listingLower) || inputNameCandidates.some((candidate) => listingLower.includes(candidate) || candidate.includes(listingLower))) {
      return listing.id;
    }
  }

  return undefined;
}

function hasReviewIntent(userMessage: string): boolean {
  const lower = userMessage.toLocaleLowerCase('tr-TR');

  return [
    'review',
    'reviews',
    'comment',
    'comments',
    'yorum',
    'yorumlar',
    'değerlendirme',
    'degerlendirme',
    'puan'
  ].some((keyword) => lower.includes(keyword));
}

function hasBookingIntent(userMessage: string): boolean {
  const lower = userMessage.toLocaleLowerCase('tr-TR');

  return [
    'book',
    'booking',
    'reserve',
    'reservation',
    'rezervasyon',
    'rezerve',
    'ayırt',
    'ayirt'
  ].some((keyword) => lower.includes(keyword));
}

function detectLanguage(userMessage: string): 'tr' | 'en' {
  const lower = userMessage.toLocaleLowerCase('tr-TR');
  const hasTurkishChars = /[çğıöşü]/i.test(userMessage);

  if (hasTurkishChars) {
    return 'tr';
  }

  const turkishHints = ['rezervasyon', 'yorum', 'ilan', 'için', 'oldu', 'olsun', 'yap'];
  if (turkishHints.some((hint) => lower.includes(hint))) {
    return 'tr';
  }

  return 'en';
}

function buildLocalizedBookingSuccessMessage(userMessage: string): string {
  const language = detectLanguage(userMessage);
  if (language === 'tr') {
    return 'Rezervasyonunuz başarıyla oluşturulmuştur.';
  }
  return 'Your reservation has been created successfully.';
}

function looksLikeToolInstructionLeak(content: string): boolean {
  const lower = content.toLocaleLowerCase('tr-TR');
  return (
    lower.includes('you can call the') ||
    lower.includes('toolcalls') ||
    lower.includes('"toolcalls"') ||
    lower.includes('provide the necessary details to proceed') ||
    lower.includes('query_listings') ||
    lower.includes('create_booking')
  );
}

function normalizeListingMatchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\p{M}]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findRequestedListingMatch(
  userMessage: string,
  listings: Array<{ id: string; title: string }>
): { id: string; title: string } | undefined {
  const normalizedMessage = normalizeListingMatchText(userMessage);
  if (!normalizedMessage) {
    return undefined;
  }

  let bestMatch: { id: string; title: string } | undefined;

  for (const listing of listings) {
    const normalizedTitle = normalizeListingMatchText(listing.title);
    if (!normalizedTitle) {
      continue;
    }

    if (normalizedMessage.includes(normalizedTitle) || normalizedTitle.includes(normalizedMessage)) {
      if (!bestMatch || normalizedTitle.length > normalizeListingMatchText(bestMatch.title).length) {
        bestMatch = listing;
      }
    }
  }

  return bestMatch;
}

function buildLocalizedSpecificListingClarificationMessage(
  userMessage: string,
  listingTitle: string
): string {
  const language = detectLanguage(userMessage);
  if (language === 'tr') {
    return `${listingTitle} için rezervasyon oluşturabilmem için giriş ve çıkış tarihlerini paylaşır mısınız?`;
  }
  return `To book ${listingTitle}, please share your check-in and check-out dates.`;
}

function buildLocalizedListingClarificationMessage(userMessage: string): string {
  const language = detectLanguage(userMessage);
  if (language === 'tr') {
    return 'Size daha iyi sonuç verebilmem için kişi sayısı ile giriş/çıkış tarihlerini paylaşır mısınız? Örn: “Paris’te 2 kişi için 5-10 Mayıs”.';
  }
  return 'To find the best options, please share number of guests and check-in/check-out dates. Example: “Paris for 2 people, May 5 to May 10”.';
}

function normalizeDateValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeToolCallInput(toolName: string, input: Record<string, unknown>): Record<string, unknown> {
  if (toolName !== 'create_booking') {
    return input;
  }

  const normalized = { ...input };
  const occupantNames = normalized.occupantNames;
  const names = normalized.names;

  if (occupantNames !== undefined && names === undefined) {
    normalized.names = occupantNames;
  }

  if (typeof normalized.names === 'string') {
    normalized.names = [normalized.names];
  }

  if (typeof normalized.occupantNames === 'string') {
    normalized.occupantNames = [normalized.occupantNames];
  }

  return normalized;
}

function sanitizeBookingNames(input: Record<string, unknown>): string[] {
  const rawNames = input.occupantNames ?? input.names;

  const cleanedFromArray = Array.isArray(rawNames)
    ? rawNames
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    : [];

  if (cleanedFromArray.length > 0) {
    return cleanedFromArray;
  }

  if (typeof rawNames === 'string' && rawNames.trim().length > 0) {
    return [rawNames.trim()];
  }

  return [DEMO_GUEST_NAME];
}

function enrichToolCallWithContext(
  toolName: string,
  input: Record<string, unknown>,
  userMessage: string,
  conversationId: string
): Record<string, unknown> {
  const context = getConversationContext(conversationId);
  const normalized = normalizeToolCallInput(toolName, input);

  if (toolName === 'create_booking' || toolName === 'query_reviews' || toolName === 'get_reviews') {
    const listingId = resolveListingIdFromContext(normalized, userMessage, context);
    if (listingId) {
      normalized.listingId = listingId;
    }
  }

  if (toolName === 'create_booking') {
    const bookingNames = sanitizeBookingNames(normalized);
    normalized.names = bookingNames;
    normalized.occupantNames = bookingNames;

    const normalizedStartDate = normalizeDateValue(normalized.startDate);
    const normalizedEndDate = normalizeDateValue(normalized.endDate);

    if (normalizedStartDate) {
      normalized.startDate = normalizedStartDate;
    } else {
      delete normalized.startDate;
    }

    if (normalizedEndDate) {
      normalized.endDate = normalizedEndDate;
    } else {
      delete normalized.endDate;
    }

    normalized.guestId = DEMO_GUEST_ID;

    if (!normalized.startDate && context.lastSearch?.startDate) {
      normalized.startDate = context.lastSearch.startDate;
    }
    if (!normalized.endDate && context.lastSearch?.endDate) {
      normalized.endDate = context.lastSearch.endDate;
    }

    if (!normalized.startDate || !normalized.endDate) {
      const { startDate, endDate } = parseRelativeBookingDates(userMessage);
      if (!normalized.startDate && startDate) {
        normalized.startDate = startDate;
      }
      if (!normalized.endDate && endDate) {
        normalized.endDate = endDate;
      }
    }
  }

  if (toolName === 'query_reviews' || toolName === 'get_reviews') {
    normalized.guestId = DEMO_GUEST_ID;
    normalized.guestName = DEMO_GUEST_NAME;
  }

  return normalized;
}

function enforceIntentToolPriority(
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> | undefined,
  userMessage: string,
  conversationId: string
): Array<{ id: string; name: string; input: Record<string, unknown> }> | undefined {
  if (!toolCalls || toolCalls.length === 0) {
    return toolCalls;
  }

  const bookingIntent = hasBookingIntent(userMessage);
  const reviewIntent = hasReviewIntent(userMessage);

  if (!bookingIntent && !reviewIntent) {
    return toolCalls;
  }

  const context = getConversationContext(conversationId);

  if (bookingIntent) {
    const directBookingCalls = toolCalls.filter((toolCall) => toolCall.name === 'create_booking');
    if (directBookingCalls.length > 0) {
      return directBookingCalls;
    }

    const listingId =
      resolveListingIdFromContext({}, userMessage, context) ||
      findRequestedListingMatch(userMessage, context.lastListings)?.id ||
      context.lastListings[0]?.id;

    if (listingId) {
      const synthesizedInput: Record<string, unknown> = { listingId };
      if (context.lastSearch?.startDate) {
        synthesizedInput.startDate = context.lastSearch.startDate;
      }
      if (context.lastSearch?.endDate) {
        synthesizedInput.endDate = context.lastSearch.endDate;
      }

      return [
        {
          id: `intent-booking-${Date.now()}`,
          name: 'create_booking',
          input: synthesizedInput
        }
      ];
    }

    return [];
  }

  if (reviewIntent) {
    const directReviewCalls = toolCalls.filter(
      (toolCall) => toolCall.name === 'query_reviews' || toolCall.name === 'get_reviews'
    );

    if (directReviewCalls.length > 0) {
      return directReviewCalls;
    }

    const listingId =
      resolveListingIdFromContext({}, userMessage, context) ||
      findRequestedListingMatch(userMessage, context.lastListings)?.id ||
      context.lastListings[0]?.id;

    if (listingId) {
      return [
        {
          id: `intent-review-${Date.now()}`,
          name: 'query_reviews',
          input: { listingId }
        }
      ];
    }

    return [];
  }

  return toolCalls;
}

/**
 * Process message through LLM with MCP tool integration
 */
async function processLLMRequest(
  socket: any,
  conversationId: string,
  userId: string,
  userMessage: string,
  jwtToken?: string
): Promise<void> {
  try {
    console.log(`[LLM] Processing message for conversation ${conversationId}, user ${userId}`);
    // Get conversation history
    const conversation = await firestoreService.getConversation(conversationId, userId);
    const history = conversation?.messages || [];

    // Build message history for LLM
    const messages = history
      .slice(-10) // Keep last 10 messages for context
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Get available MCP tools
    const tools = mcpClient.getTools().map((tool: any) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // Get LLM response
    const llmResponse = await llmClient.processMessage(messages, tools);
      console.log(`LLM response received for conversation ${conversationId}:`, {
        hasContent: !!llmResponse.content,
        contentLength: llmResponse.content?.length,
        toolCallCount: llmResponse.toolCalls?.length || 0
      });

    // Ollama may return tool calls as JSON string in content; normalize here.
    let normalizedToolCalls = llmResponse.toolCalls;
    if ((!normalizedToolCalls || normalizedToolCalls.length === 0) && llmResponse.content) {
      const parsed = extractToolCallsFromMixedContent(llmResponse.content);
      if (parsed?.toolCalls && parsed.toolCalls.length > 0) {
        normalizedToolCalls = parsed.toolCalls
          .filter((call) => typeof call.name === 'string')
          .map((call, index) => ({
            id: call.id || `ollama-tool-${Date.now()}-${index}`,
            name: call.name as string,
            input: call.input && typeof call.input === 'object' ? call.input : {}
          }));
      }
    }

    normalizedToolCalls = enforceIntentToolPriority(
      normalizedToolCalls,
      userMessage,
      conversationId
    );

    if ((!normalizedToolCalls || normalizedToolCalls.length === 0) && hasBookingIntent(userMessage)) {
      const context = getConversationContext(conversationId);
      const listingId =
        resolveListingIdFromContext({}, userMessage, context) || context.lastListings[0]?.id;

      if (listingId) {
        const bookingInput: Record<string, unknown> = { listingId };

        if (context.lastSearch?.startDate) {
          bookingInput.startDate = context.lastSearch.startDate;
        }
        if (context.lastSearch?.endDate) {
          bookingInput.endDate = context.lastSearch.endDate;
        }

        normalizedToolCalls = [
          {
            id: `context-booking-${Date.now()}`,
            name: 'create_booking',
            input: bookingInput
          }
        ];
      }
    }

    if ((!normalizedToolCalls || normalizedToolCalls.length === 0) && hasReviewIntent(userMessage)) {
      const context = getConversationContext(conversationId);
      const listingId =
        resolveListingIdFromContext({}, userMessage, context) || context.lastListings[0]?.id;

      if (listingId) {
        normalizedToolCalls = [
          {
            id: `context-review-${Date.now()}`,
            name: 'query_reviews',
            input: { listingId }
          }
        ];
      }
    }

    // Process any tool calls
    let toolResults: any[] = [];

    if (normalizedToolCalls && normalizedToolCalls.length > 0) {
      for (const toolCall of normalizedToolCalls) {
        try {
          const toolInput = enrichToolCallWithContext(
            toolCall.name,
            (toolCall.input && typeof toolCall.input === 'object'
              ? toolCall.input
              : {}) as Record<string, unknown>,
            userMessage,
            conversationId
          );

          const result = await mcpClient.executeTool(toolCall.name, toolInput, jwtToken);

          toolResults.push({
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result
          });

          updateContextFromToolResult(conversationId, toolCall.name, toolInput, result);

          // Emit tool execution status to client
          socket.emit('tool_executed', {
            toolName: toolCall.name,
            status: 'success'
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';

          toolResults.push({
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            error: errorMsg
          });

          // Emit tool execution error
          socket.emit('tool_executed', {
            toolName: toolCall.name,
            status: 'error',
            error: errorMsg
          });
        }
      }

      // If tools were called, get a final response from LLM with tool results
      if (toolResults.length > 0) {
        const hasSuccessfulBooking = toolResults.some(
          (toolResult) => toolResult.toolName === 'create_booking' && !toolResult.error
        );

        if (hasSuccessfulBooking) {
          llmResponse.content = buildLocalizedBookingSuccessMessage(userMessage);
        } else {
        // Add tool results to messages
        messages.push({
          role: 'assistant',
          content: llmResponse.content
        });

        // Add tool results as user message for next LLM call
        messages.push({
          role: 'user',
          content:
            `Tool results: ${JSON.stringify(toolResults)}\n\n` +
            'Now provide a clean natural-language response for the user. ' +
            'Do NOT return JSON and do NOT include toolCalls.'
        });

        // Get final response from LLM
        const finalResponse = await llmClient.processMessage(messages, []);
        llmResponse.content = extractCleanAssistantText(finalResponse.content);
        }
      }
    }

    let cleanAssistantContent = extractCleanAssistantText(llmResponse.content);

    if (
      (!normalizedToolCalls || normalizedToolCalls.length === 0) &&
      llmResponse.content &&
      looksLikeToolInstructionLeak(llmResponse.content)
    ) {
      cleanAssistantContent = buildLocalizedListingClarificationMessage(userMessage);
    }

    if (toolResults.length > 0) {
      const looksLikeJson = cleanAssistantContent.trim().startsWith('{') || cleanAssistantContent.trim().startsWith('[');
      if (!cleanAssistantContent.trim() || looksLikeJson) {
        const successCount = toolResults.filter((r) => !r.error).length;
        const errorCount = toolResults.filter((r) => Boolean(r.error)).length;
        cleanAssistantContent =
          errorCount > 0
            ? `I processed your request. ${successCount} tool call(s) succeeded and ${errorCount} failed.`
            : 'I processed your request successfully and found results for you.';
      }
    }

    // Save assistant message to Firestore
    await firestoreService.saveMessage(conversationId, userId, {
      role: 'assistant',
      content: cleanAssistantContent,
      toolCalls: normalizedToolCalls,
      toolResults: toolResults.length > 0 ? toolResults : undefined
    });

    // Emit final response to client
    console.log(`Emitting agent_response to socket ${socket.id} for conversation ${conversationId}`);
    socket.emit('agent_response', {
      role: 'assistant',
      content: cleanAssistantContent,
      toolResults: toolResults
    });
  } catch (error) {
    console.error('Error in LLM processing:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    throw error;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Initialize MCP client and start server
 */
async function startServer() {
  try {
    // Initialize MCP client
    await mcpClient.initialize();
    console.log('MCP client initialized');

    // Start HTTP and WebSocket server
    const activePort = await listenOnAvailablePort(initialPort);
    console.log(`Agent Backend listening on port ${activePort}`);
    console.log(`LLM Provider: ${process.env.LLM_PROVIDER || 'openai'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mcpClient.shutdown();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();
