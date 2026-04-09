# SE4458 Assignment 2: AI Agent for Listing System

## 📋 Assignment Overview

This is a **4-layer architecture** implementation for an AI-powered listing accommodation system:

```
┌─────────────────────────────┐
│   React Frontend (Port 3000) │  ← Chat UI with WebSocket
└──────────────┬──────────────┘
               │ WebSocket + REST
┌──────────────▼──────────────┐
│ Agent Backend (Port 5000)    │  ← LLM + Firestore
│  - OpenAI/Ollama LLM        │
│  - MCP Client                │
└──────────────┬──────────────┘
               │ MCP Protocol
┌──────────────▼──────────────┐
│   MCP Server (Port 3001)     │  ← Tool wrapper
│  - Query Listings            │
│  - Create Booking            │
│  - Create Review             │
└──────────────┬──────────────┘
               │ HTTP REST
┌──────────────▼──────────────┐
│ API Gateway (Port 8080)      │  ← Rate limiting
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ Midterm APIs (Port 4000)     │  ← Your existing APIs
│  - Guest, Host, Admin        │
└─────────────────────────────┘
```

## 🚀 Quick Start Guide

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (already setup from midterm)
- OpenAI API key OR Ollama (local)
- Firebase project with credentials

### Step 1: Environment Setup

#### 1.1 MCP Server `.env`

```bash
cd mcp-server
cp .env.example .env
```

Edit `.env`:
```
API_GATEWAY_URL=http://localhost:8080
MCP_SERVER_PORT=3001
```

#### 1.2 Agent Backend `.env`

```bash
cd agent-backend
cp .env.example .env
```

Edit `.env` with your credentials:
```
PORT=5000
NODE_ENV=development

# Choose LLM provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-... # Get from https://platform.openai.com/api-keys
OPENAI_MODEL=gpt-3.5-turbo

# OR use Ollama
# LLM_PROVIDER=ollama
# OLLAMA_API_URL=http://localhost:11434
# OLLAMA_MODEL=mistral

# Firebase (Client SDK Configuration)
FIREBASE_API_KEY=... # From Firebase Console
FIREBASE_AUTH_DOMAIN=... # From Firebase Console
FIREBASE_PROJECT_ID=... # From Firebase Console
FIREBASE_STORAGE_BUCKET=... # From Firebase Console
FIREBASE_MESSAGING_SENDER_ID=... # From Firebase Console
FIREBASE_APP_ID=... # From Firebase Console

API_GATEWAY_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
```

**To get Firebase credentials (Client SDK):**
1. Go to Firebase Console → Your Project
2. Project Settings (gear icon)
3. Under "Your apps" section, find or create a web app
4. Copy the firebaseConfig object containing apiKey, projectId, authDomain, etc.
5. Copy each value to the corresponding `.env` variable

**Note:** The agent-backend uses Firebase Client SDK (not Admin SDK) for better compatibility with frontend apps. For production with backend-only operations, consider upgrading to Admin SDK with service account credentials.

#### 1.3 Web Frontend `.env`

```bash
cd web-frontend
# .env.local is already created
# Verify it contains: VITE_BACKEND_URL=http://localhost:5000
```

### Step 2: Install Dependencies

```bash
# MCP Server
cd mcp-server && npm install && cd ..

# Agent Backend
cd agent-backend && npm install && cd ..

# Web Frontend
cd web-frontend && npm install && cd ..
```

### Step 3: Start All Services (in separate terminals)

**Terminal 1: Midterm API**
```bash
npm run dev  # From root directory (runs both main API and gateway)
```

**Terminal 2: MCP Server**
```bash
cd mcp-server
npm run dev
# Expected output: "Listing MCP server started successfully"
```

**Terminal 3: Agent Backend**
```bash
cd agent-backend
npm run dev
# Expected output: "Agent Backend listening on port 5000"
```

**Terminal 4: Web Frontend**
```bash
cd web-frontend
npm run dev
# Expected output: "Local: http://localhost:3000"
```

### Step 4: Test the System

1. Open **http://localhost:3000** in your browser
2. Click "+ New Conversation" in the sidebar
3. Enter a conversation name like "Paris Trip"
4. Ask: **"Find a place for 2 people in Paris for 5 days"**
5. The agent will:
   - Understand your request via LLM
   - Call the Query Listings MCP tool
   - Return matching accommodations
   - Display results in the chat

## 📁 New File Structure

```
se4458-midterm/
├── src/                          # Your existing API
├── gateway/                       # Your existing Gateway
├── prisma/                        # Your existing Prisma setup
│
├── mcp-server/                    # NEW: MCP Server
│   ├── src/
│   │   ├── index.ts              # MCP server entry point
│   │   ├── tools.ts              # Tool definitions & execution
│   │   ├── api-client.ts         # HTTP client for APIs
│   │   └── types.ts              # Type definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── agent-backend/                 # NEW: Agent Backend
│   ├── src/
│   │   ├── index.ts              # Express + Socket.io server
│   │   ├── firestore.ts          # Firestore integration
│   │   ├── llm.ts                # LLM clients (OpenAI/Ollama)
│   │   ├── mcp-client.ts         # MCP client connection
│   │   └── types.ts              # Type definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── web-frontend/                  # NEW: React Frontend
    ├── src/
    │   ├── main.tsx              # React entry point
    │   ├── App.tsx               # Main app component
    │   ├── App.css               # App styles
    │   ├── types.ts              # TypeScript types
    │   ├── api.ts                # API client
    │   ├── socket.ts             # WebSocket client
    │   ├── components/
    │   │   ├── ChatWindow.tsx    # Chat interface
    │   │   ├── ChatWindow.css
    │   │   ├── MessageBubble.tsx # Message display
    │   │   ├── MessageBubble.css
    │   │   ├── Sidebar.tsx       # Conversations sidebar
    │   │   └── Sidebar.css
    │   ├── index.css             # Global styles
    │   └── main.tsx              # App initialization
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json
    └── .env.local
```

## 🔧 Component Details

### MCP Server (Port 3001)

**Provides 3 tools:**
- `query_listings` - Search accommodations
- `create_booking` - Book a listing
- `create_review` - Leave a review

**Input Parameters Example:**

```bash
# Query Listings
{
  "city": "Paris",
  "country": "France",
  "people": 2,
  "startDate": "2025-04-15",
  "endDate": "2025-04-20",
  "minRating": 4.0
}

# Create Booking
{
  "listingId": "uuid-1234",
  "startDate": "2025-04-15",
  "endDate": "2025-04-20",
  "occupantNames": ["John Doe", "Jane Smith"],
  "_token": "jwt-token-here"  # Required for auth
}

# Create Review
{
  "bookingId": "uuid-5678",
  "listingId": "uuid-1234",
  "rating": 5,
  "comment": "Amazing place!",
  "_token": "jwt-token-here"
}
```

### Agent Backend (Port 5000)

**REST Endpoints:**
- `GET /conversations` - Get all user conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id` - Get conversation with messages
- `DELETE /conversations/:id` - Delete conversation
- `GET /health` - Health check

**WebSocket Events:**
- `send_message` - User sends message
- `message_saved` - Message saved to Firestore
- `agent_response` - Agent's response
- `tool_executed` - Tool execution status
- `load_conversation` - Load conversation history
- `conversation_loaded` - Conversation data received

### Web Frontend (Port 3000)

**Features:**
- ✅ Real-time chat interface with WebSocket
- ✅ Conversation history management
- ✅ Tool result visualization (listings grid)
- ✅ Responsive design
- ✅ Message persistence via Firestore

## 🤖 How LLM Integration Works

### OpenAI (Recommended)

1. The Agent receives user message: *"Find a place for 2 in Paris"*
2. LLM (GPT-3.5/GPT-4) understands intent
3. LLM calls MCP tool: `query_listings` with parameters:
   ```json
   { "city": "Paris", "people": 2 }
   ```
4. Results returned to LLM
5. LLM generates user-friendly response
6. Response + results sent back to frontend

### Ollama (Local/Private)

For privacy, use local Ollama:

```bash
# Install Ollama from https://ollama.ai
# Run: ollama pull mistral  # or other model
ollama serve
```

Then set in `.env`:
```
LLM_PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

## 🔐 Authentication & JWT Tokens

The frontend uses demo tokens for testing. In production:

```typescript
// For authenticated API calls (booking, review):
const response = await mcpClient.executeTool(
  'create_booking',
  bookingData,
  userJwtToken  // Passed here
);
```

Tokens are automatically forwarded to MCP tools as `_token` parameter.

## 🗄️ Firestore Database Structure

```
firestore/
└── conversations/
    ├── {conversationId1}/
    │   ├── userId: "user-123"
    │   ├── title: "Paris Trip"
    │   ├── createdAt: timestamp
    │   ├── updatedAt: timestamp
    │   └── messages/
    │       ├── {messageId1}/
    │       │   ├── role: "user"
    │       │   ├── content: "Find..."
    │       │   ├── createdAt: timestamp
    │       │   └── userId: "user-123"
    │       └── {messageId2}/
    │           ├── role: "assistant"
    │           ├── content: "I found..."
    │           ├── toolResults: [...]
    │           ├── createdAt: timestamp
    │           └── userId: "user-123"
    └── {conversationId2}/
        ...
```

## 🧪 Testing Example Prompts

```
1. "Find a 2-person place in Istanbul under 100$/night"
2. "Search for accommodation in Barcelona for 4 people"
3. "Show me highly-rated places (4.5+) in Rome"
4. "I need a place in Paris from 2025-05-01 to 2025-05-07 for 3 people"
5. "Book a listing for me" (requires listing details first)
```

## 📊 Debugging

### Check MCP Server is running:
```bash
curl http://localhost:3001/health
```

### Check Agent Backend:
```bash
curl http://localhost:5000/health
```

### View logs:
```bash
# Terminal where agent-backend runs - shows LLM calls
# Terminal where frontend runs - shows Socket.io events
# Browser DevTools - Console tab for frontend errors
```

### Common Issues:

**"MCP Server not responding"**
- ✅ Ensure `cd mcp-server && npm run dev`
- ✅ Check port 3001 is not in use

**"OpenAI API error"**
- ✅ Verify `OPENAI_API_KEY` in `.env`
- ✅ Check API key has access: https://platform.openai.com/account/api-keys

**"Firestore connection error"**
- ✅ Download Firebase service account JSON
- ✅ Copy exact values to `.env` (watch for newlines)

**"Socket.io connection refused"**
- ✅ Frontend URL must match CORS in agent-backend: `http://localhost:3000`
- ✅ Backend must be running on port 5000

## 🐳 Docker Deployment (Optional)

Create `docker-compose.yml` for all services:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: listing_db
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    ports:
      - "4000:4000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://admin:password@postgres:5432/listing_db

  gateway:
    build: .
    ports:
      - "8080:8080"
    environment:
      TARGET_URL: http://api:4000

  mcp-server:
    build: ./mcp-server
    ports:
      - "3001:3001"

  agent-backend:
    build: ./agent-backend
    ports:
      - "5000:5000"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      FIREBASE_API_KEY: ${FIREBASE_API_KEY}
      FIREBASE_AUTH_DOMAIN: ${FIREBASE_AUTH_DOMAIN}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_STORAGE_BUCKET: ${FIREBASE_STORAGE_BUCKET}
      FIREBASE_MESSAGING_SENDER_ID: ${FIREBASE_MESSAGING_SENDER_ID}
      FIREBASE_APP_ID: ${FIREBASE_APP_ID}

  frontend:
    build: ./web-frontend
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

Deploy:
```bash
docker-compose up
```

## 📈 Performance Considerations

- **MCP Tools**: Implement caching for listing queries
- **LLM Rate Limit**: Limit requests to 100/hour per user
- **Firestore**: Add indexes on `userId, createdAt`
- **WebSocket**: Implement reconnection backoff

## ✅ Assignment Checklist

- ✅ **MCP Server**: 3 tools (query, book, review)
- ✅ **Agent Backend**: Express + Socket.io + Firestore
- ✅ **LLM Integration**: OpenAI + Ollama support
- ✅ **Frontend**: React chat UI with real-time updates
- ✅ **Message Persistence**: Firestore storage
- ✅ **Tool Visualization**: Show listings as cards
- ✅ **Authentication**: JWT token forwarding
- ✅ **Error Handling**: Graceful error messages
- ✅ **Documentation**: Complete setup guide

## 📚 Additional Resources

- MCP Spec: https://spec.modelcontextprotocol.io/
- OpenAI API: https://platform.openai.com/docs
- Ollama: https://ollama.ai
- Firestore: https://firebase.google.com/docs/firestore
- Socket.io: https://socket.io/docs/

---

**Author**: SE4458 Student (Group 2 - Listing System)  
**Date**: April 2025  
**Status**: Complete & Ready for Deployment
