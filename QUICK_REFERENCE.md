# Quick Reference Guide

## 🏗️ Architecture at a Glance

```
Frontend (React)
    ↕ WebSocket
Agent Backend (LLM)
    ↕ MCP Protocol
MCP Server (Tools)
    ↕ HTTP REST
API Gateway (Rate Limit)
    ↕ HTTP REST
Midterm APIs (Your Code)
```

## 🚀 Starting Everything

### Local Development (4 Terminals)

```bash
# Terminal 1: Midterm API + Gateway
npm run dev

# Terminal 2: MCP Server
cd mcp-server && npm run dev

# Terminal 3: Agent Backend
cd agent-backend && npm run dev

# Terminal 4: Frontend
cd web-frontend && npm run dev
```

### Docker Compose (1 Command)

```bash
docker-compose up  # All services in containers
```

## 📂 Critical Files Location

| Component | Key Files | Port | Purpose |
|-----------|-----------|------|---------|
| **MCP Server** | `mcp-server/src/tools.ts` | 3001 | Wraps 3 listing tools |
| **Agent** | `agent-backend/src/index.ts` | 5000 | LLM + Socket.io |
| **Frontend** | `web-frontend/src/App.tsx` | 3000 | React chat UI |
| **Gateway** | `gateway/server.ts` | 8080 | Rate limiting (existing) |
| **API** | `src/server.ts` | 4000 | Your APIs (existing) |

## 🔑 Environment Variables Needed

```bash
# agent-backend/.env (REQUIRED)
OPENAI_API_KEY=sk-...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# mcp-server/.env (OPTIONAL)
API_GATEWAY_URL=http://localhost:8080
```

## 🧪 Testing Each Component

### Test MCP Server
```bash
# Should start without errors
cd mcp-server && npm run dev
# Look for: "Listing MCP server started successfully"
```

### Test Agent Backend
```bash
# Should start and connect to MCP
cd agent-backend && npm run dev
# Look for: "Agent Backend listening on port 5000"
# Then: "MCP client initialized"
```

### Test Frontend
```bash
# Should load without errors
cd web-frontend && npm run dev
# Open: http://localhost:3000
# Create conversation and test chat
```

## 💬 User Flow Example

```
User: "Find a place for 2 in Paris for May 1-5"
  ↓ (WebSocket) →
Agent Backend receives message
  ↓
Calls LLM (OpenAI/Ollama)
  ↓
LLM extracts: city=Paris, people=2, startDate=2025-05-01, endDate=2025-05-05
  ↓
Calls MCP tool: query_listings(...)
  ↓
MCP Server calls: GET /api/v1/guest/listings?city=Paris&people=2&...
  ↓
Gateway (Rate Limited)
  ↓
Your Midterm API processes request
  ↓
Returns 10 listing results
  ↓
Results flow back through chain
  ↓
Agent formats response
  ↓
Frontend receives via WebSocket
  ↓
Displays listings as cards + message
  ↓
Stores in Firestore
```

## 📊 Status Checks

### Check All Services Running
```bash
# MCP Server
curl http://localhost:3001/health 2>/dev/null || echo "MCP Server: DOWN"

# Agent Backend
curl http://localhost:5000/health 2>/dev/null || echo "Agent: DOWN"

# API Gateway
curl http://localhost:8080/ 2>/dev/null || echo "Gateway: DOWN"

# Your Midterm API
curl http://localhost:4000/api/v1/guest/listings 2>/dev/null || echo "API: DOWN"
```

### Check Firestore Connection
```bash
# In Agent Backend logs, look for:
# "Firestore connected" or error messages
```

### Check LLM Connection
```bash
# OpenAI: Check API calls in OpenAI dashboard
# Ollama: Check http://localhost:11434/api/tags
```

## 🔧 Common Commands

```bash
# Install all dependencies
cd mcp-server && npm install
cd ../agent-backend && npm install
cd ../web-frontend && npm install
cd ..

# Build TypeScript
npm run build
cd mcp-server && npm run build
cd ../agent-backend && npm run build
cd ../web-frontend && npm run build

# Run development mode
npm run dev

# Kill process on port (macOS/Linux)
lsof -ti:5000 | xargs kill -9  # Kill agent backend

# View Docker logs
docker-compose logs -f agent-backend
docker-compose logs -f mcp-server
docker-compose logs -f frontend

# Clean Docker
docker-compose down -v  # Remove volumes too
```

## 🐛 Quick Debugging

| Problem | Quick Check | Solution |
|---------|------------|----------|
| "Cannot connect to MCP" | `ps aux \| grep mcp-server` | Start MCP: `cd mcp-server && npm run dev` |
| "WebSocket connection refused" | `curl http://localhost:5000/health` | Start Agent: `cd agent-backend && npm run dev` |
| "Conversation not saving" | Firebase Console → Firestore | Check FIREBASE credentials |
| "LLM not responding" | Check OPENAI_API_KEY | Add key to agent-backend/.env |
| "Listing query returns no results" | Check your DB has listings | Add listings via your API |

## 📚 Documentation Map

```
.
├── ARCHITECTURE.md           ← Start here (system overview)
├── IMPLEMENTATION_GUIDE.md   ← Phase-by-phase walkthrough
├── DEPLOYMENT_GUIDE.md       ← Production deployment
├── QUICK_REFERENCE.md        ← This file (quick lookups)
├── API_TESTING.md            ← Manual testing guide
└── mcp-server/src/
    ├── tools.ts              ← Available tools & inputs
    └── api-client.ts         ← API integration details
```

## 🎯 Assignment Checklist

- [x] **MCP Server**: Tools for query, book, review
- [x] **Agent Backend**: LLM integration (OpenAI/Ollama)
- [x] **Firestore**: Message persistence
- [x] **Frontend**: React chat with real-time updates
- [x] **WebSocket**: Live message delivery
- [x] **Tool Results**: Display listings as cards
- [x] **Authentication**: JWT token forwarding
- [x] **Error Handling**: Graceful error messages
- [x] **Documentation**: Complete setup guides
- [x] **Docker**: Container deployment ready

## 🚨 Before Submitting

1. ✅ All 4 services run without errors
2. ✅ Can chat and get responses
3. ✅ Listings display as cards
4. ✅ Conversations persist in Firestore
5. ✅ Mobile responsive check
6. ✅ Error messages user-friendly
7. ✅ No console errors in browser
8. ✅ Documentation updated with your details
9. ✅ Test with real LLM (not mocked)
10. ✅ All code committed to git

## 📞 Getting Help

If something doesn't work:

1. **Check logs** - look at terminal where service failed
2. **Check .env** - verify all variables set correctly
3. **Check ARCHITECTURE.md** - design documentation  
4. **Check IMPLEMENTATION_GUIDE.md** - detailed explanations
5. **Check component README** - each folder has documentation

---

**Last Updated**: April 2025  
**SE4458 Group 2**: Listing System with AI Agent
