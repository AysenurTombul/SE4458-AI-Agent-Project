# Step-by-Step Implementation Guide

## Phase 1: MCP Server Setup

### What is MCP?

MCP (Model Context Protocol) is a standardized protocol for AI models to call external tools. It allows an LLM to:
1. Discover available tools
2. Request tool executions
3. Receive tool results

In our case, we're wrapping your existing Listing APIs as MCP tools.

### Files Created for MCP Server:

```
mcp-server/
├── src/
│   ├── index.ts          # MCP Server entry point
│   ├── tools.ts          # Tool definitions (query, book, review)
│   ├── api-client.ts     # HTTP client to call your API Gateway
│   └── types.ts          # TypeScript interfaces
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

### Key Implementation Points:

#### `src/tools.ts` - Tool Definitions
- Defines 3 tools with schemas (what LLM needs to know)
- `executeTool()` function handles tool calls
- Validates inputs and calls API client

#### `src/api-client.ts` - API Integration
- Makes HTTP calls to your API Gateway
- Handles authentication (JWT tokens)
- Transforms responses

#### `src/index.ts` - MCP Server
- Listens on stdio (standard input/output)
- Responds to `ListTools` requests
- Handles `CallTool` requests

### Test MCP Server:

```bash
cd mcp-server
npm install
npm run dev

# In another terminal, test tools are loaded:
# The server will log "Listing MCP server started successfully"
```

---

## Phase 2: Agent Backend Setup

### What Does Agent Backend Do?

1. **Receives messages from frontend** via WebSocket
2. **Calls LLM (OpenAI/Ollama)** to understand user intent
3. **Executes MCP tools** based on LLM's decision
4. **Stores conversations** in Firestore
5. **Sends responses back** to frontend

### Files Created for Agent Backend:

```
agent-backend/
├── src/
│   ├── index.ts          # Main Express + Socket.io server
│   ├── firestore.ts      # Firestore database operations
│   ├── llm.ts            # LLM client (OpenAI/Ollama)
│   ├── mcp-client.ts     # MCP client connection
│   └── types.ts          # TypeScript interfaces
├── package.json
└── tsconfig.json
```

### Key Components:

#### `src/llm.ts` - Language Model Integration

Two implementations:

**OpenAI Client:**
```typescript
// Sends messages to GPT-3.5-turbo/GPT-4
// LLM decides which tools to call
// Receives function calls back
```

**Ollama Client (Local):**
```typescript
// Runs Mistral/Llama2 locally
// No API key needed
// Slower but private
```

#### `src/firestore.ts` - Message Storage

Database schema:
```
conversations/
  └── {conversationId}
      ├── userId
      ├── title
      ├── createdAt
      ├── updatedAt
      └── messages/
          └── {messageId}
              ├── role: "user" | "assistant"
              ├── content: string
              ├── toolCalls?: array
              ├── toolResults?: array
              └── createdAt
```

#### `src/mcp-client.ts` - Tool Execution

Maintains connection to MCP Server
Calls tools when LLM requests them

```typescript
// Example: LLM wants to query listings
const result = await mcpClient.executeTool(
  'query_listings',
  { city: 'Paris', people: 2 },
  jwtToken
);
```

#### `src/index.ts` - Main Server

**REST Endpoints:**
- `GET /conversations` - List conversations
- `POST /conversations` - Create conversation
- `GET /conversations/:id` - Get conversation with history
- `DELETE /conversations/:id` - Delete conversation

**WebSocket Events:**
- `send_message` - User sends chat message
- `load_conversation` - Load conversation history
- `message_saved` - Confirm message saved
- `agent_response` - Agent's response
- `tool_executed` - Tool execution status

### Test Agent Backend:

```bash
cd agent-backend
npm install

# Create .env file with:
# - OPENAI_API_KEY
# - FIREBASE credentials
# - API_GATEWAY_URL

npm run dev

# Expected: "Agent Backend listening on port 5000"
```

---

## Phase 3: React Frontend Setup

### What Does Frontend Do?

1. **Chat Interface** - Send/receive messages
2. **Conversation Management** - Create, select, delete conversations
3. **Real-time Updates** - WebSocket connection to agent
4. **Result Display** - Show listings in attractive cards
5. **Firestore Integration** - Persist conversations

### Files Created for Frontend:

```
web-frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main component
│   ├── App.css
│   ├── socket.ts             # WebSocket client wrapper
│   ├── api.ts                # REST API client
│   ├── types.ts              # TypeScript types
│   ├── components/
│   │   ├── ChatWindow.tsx    # Chat messages display
│   │   ├── ChatWindow.css
│   │   ├── MessageBubble.tsx # Individual message
│   │   ├── MessageBubble.css
│   │   ├── Sidebar.tsx       # Conversations list
│   │   └── Sidebar.css
│   ├── index.css
│   └── main.tsx
├── vite.config.ts            # Vite build config
├── index.html
├── package.json
└── .env.local
```

### Key Components:

#### `App.tsx` - Main App
- Manages conversations list
- Handles conversation CRUD
- Routes between screens
- Welcome screen when no conversation selected

#### `Sidebar.tsx` - Navigation
- Lists all conversations
- Create new conversation form
- Delete conversation button
- User info display

#### `ChatWindow.tsx` - Chat Interface
- Displays messages
- Handles message input/send
- WebSocket connection management
- Loading states

#### `MessageBubble.tsx` - Message Display
- Shows user/assistant messages
- Displays tool execution status
- Renders listing results as grid cards
- Shows timestamps

#### `api.ts` - REST Client
```typescript
// Conversation endpoints
getConversations()
createConversation(title)
getConversation(id)
deleteConversation(id)
```

#### `socket.ts` - WebSocket Client
```typescript
// Connects to Agent Backend
// Sends messages
// Listens for responses
// Handles reconnection
```

### Component Flow:

```
User Types Message
        ↓
ChatWindow.handleSendMessage()
        ↓
socket.sendMessage() → Agent Backend
        ↓
Agent receives via Socket.io
        ↓
Calls LLM → MCP Server → Your APIs
        ↓
socket.emit('agent_response')
        ↓
MessageBubble displays response + results
        ↓
Stored in Firestore
```

### Styling Strategy:

- **CSS Grid** for responsive layout
- **Flexbox** for component arrangement
- **CSS Variables** for theming
- **Mobile-first** responsive design

### Test Frontend:

```bash
cd web-frontend
npm install
npm run dev

# Open http://localhost:3000
# Should see welcome screen
# Create conversation and start chatting
```

---

## Phase 4: Integration Testing

### Test Scenario 1: Basic Query

1. Open frontend → Create "Paris Search"
2. Type: "Find a place for 2 people in Paris"
3. Expected flow:
   ```
   Frontend → Agent Backend (WebSocket)
           ↓
   Agent calls LLM
   LLM extracts: city=Paris, people=2
   Agent calls MCP: query_listings()
   MCP calls API Gateway
   Gateway calls Your Midterm API
   Results returned through chain
   Frontend displays listings grid
   ```

### Test Scenario 2: Booking

1. After listing query, say: "Book listing {listing-id} for May 1-5"
2. System should:
   - Call `create_booking` MCP tool
   - Forward JWT token
   - Show success/error message

### Test Scenario 3: Persistence

1. Create conversation with queries
2. Refresh browser
3. Conversation history should reload from Firestore
4. Messages should be queryable

### Debugging Commands:

```bash
# Check all services running:
curl http://localhost:3001/health  # MCP Server
curl http://localhost:5000/health  # Agent
curl http://localhost:8080/api/v1/guest/listings  # Gateway
curl http://localhost:4000/api/v1/guest/listings  # Your API

# Check logs:
# - MCP Server logs: terminal running mcp-server
# - Agent logs: terminal running agent-backend
# - Frontend logs: browser console (F12)
# - Firestore: Firebase Console → Firestore Database
```

---

## Phase 5: File Change Reference

### Files You Need to MODIFY:

**1. Root package.json** - Add scripts to run all services together:
```json
{
  "scripts": {
    "dev:all": "concurrently 'npm run dev' 'cd mcp-server && npm run dev' 'cd agent-backend && npm run dev' 'cd web-frontend && npm run dev'"
  }
}
```

**2. Your existing API Gateway** - Optional: Add WebSocket support:
```typescript
// No changes required - frontend connects directly to agent-backend
```

**3. Your existing Midterm APIs** - No changes required:
```typescript
// MCP Server calls APIs via HTTP
// All integration is external
```

### Files You DON'T Need to Change:

- ❌ `src/controllers/` - Leave as is
- ❌ `src/services/` - Leave as is
- ❌ `prisma/schema.prisma` - Leave as is
- ❌ `src/routes/` - Leave as is

Everything new is in separate directories!

---

## Phase 6: Deployment Checklist

- [ ] All 4 services running locally
- [ ] Test each conversation management endpoint
- [ ] Test chat with real LLM (not mocked)
- [ ] Test tool execution (query listings)
- [ ] Verify Firestore persistence
- [ ] Check error handling scenarios
- [ ] Test with multiple users (different IDs)
- [ ] Performance test with large conversation history
- [ ] Mobile responsiveness check
- [ ] Production environment variables set

---

## Common Issues & Solutions

### Issue: "Cannot find module '@modelcontextprotocol/sdk'"

**Solution:**
```bash
cd mcp-server
npm install @modelcontextprotocol/sdk --save
```

### Issue: "FIREBASE_PRIVATE_KEY is not valid"

**Solution:**
Ensure you're properly escaping newlines:
```bash
# In .env file, use:
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"

# In Node code:
process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
```

### Issue: "WebSocket connection refused"

**Solution:**
1. Check Agent Backend is running: `curl http://localhost:5000/health`
2. Check CORS configuration in `agent-backend/src/index.ts`:
   ```typescript
   origin: process.env.FRONTEND_URL || 'http://localhost:3000'
   ```
3. Verify frontend URL matches

### Issue: "LLM is not making tool calls"

**Solution:**
1. Check LLM response in agent logs
2. Verify tools are properly formatted in schema
3. Try simpler prompt: "Search Paris"
4. Check LLM model supports function calling (GPT-4 > GPT-3.5-turbo)

---

## Next Steps

1. **Deploy to Production:**
   - Use Docker Compose
   - Set up managed database
   - Configure Firebase Security Rules
   - Use CDN for frontend assets

2. **Scale the System:**
   - Add rate limiting per user
   - Implement tool result caching
   - Add logging/monitoring
   - Performance optimization

3. **Enhance Features:**
   - Multi-language support
   - Payment integration
   - Message export
   - Advanced analytics

---

**Questions? Check the main ARCHITECTURE.md file for more details!**
