# API Testing Guide (Manual)

Use these commands to test each component independently.

## 🔧 Tools Needed

- `curl` (comes with macOS/Linux)
- Postman or `curl` for HTTP requests
- Browser DevTools for frontend testing
- Firebase Console for Firestore inspection

## 0️⃣ Prerequisites

Ensure services are running:

```bash
# Terminal 1
npm run dev

# Terminal 2
cd mcp-server && npm run dev

# Terminal 3
cd agent-backend && npm run dev

# Terminal 4
cd web-frontend && npm run dev
```

---

## 1️⃣ Test Midterm API (Existing)

### Query Listings (No Auth)

```bash
curl -X GET "http://localhost:4000/api/v1/guest/listings?city=Paris&people=2" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "uuid-1",
      "title": "Cozy Paris Apartment",
      "city": "Paris",
      "country": "France",
      "capacity": 4,
      "price": 120,
      "ratingAverage": 4.5
    }
  ],
  "total": 15,
  "page": 1,
  "size": 10
}
```

### Create Booking (Requires Auth)

```bash
# First, get a JWT token from auth endpoint
JWT="your-jwt-token-here"

curl -X POST "http://localhost:4000/api/v1/guest/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "listingId": "uuid-1",
    "startDate": "2025-04-15",
    "endDate": "2025-04-20",
    "occupantNames": ["John Doe", "Jane Smith"]
  }'
```

---

## 2️⃣ Test API Gateway (Existing)

### Rate Limiting Check

```bash
# Make 4 requests from same IP - 4th should fail with 429
for i in {1..4}; do
  echo "Request $i:"
  curl -X GET "http://localhost:8080/api/v1/guest/listings" \
    -H "X-Forwarded-For: 192.168.1.1"
  echo ""
done
```

---

## 3️⃣ Test MCP Server (New)

### Check Server Status

```bash
# MCP uses stdio, so direct HTTP testing isn't standard
# Instead, verify it starts without errors:
cd mcp-server && npm run dev
# Should see: "Listing MCP server started successfully"
```

### Check Tools are Available

The Agent Backend will list available tools. Check logs:

```bash
cd agent-backend && npm run dev
# Should see MCP tools loaded in logs
```

---

## 4️⃣ Test Agent Backend (New)

### Health Check

```bash
curl -X GET "http://localhost:5000/health" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-04-01T12:00:00.000Z"
}
```

### Create Conversation

```bash
curl -X POST "http://localhost:5000/conversations" \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "title": "Paris Trip Planning"
  }'
```

**Expected Response:**
```json
{
  "id": "conv-123",
  "title": "Paris Trip Planning",
  "userId": "test-user-123"
}
```

### Get Conversations

```bash
curl -X GET "http://localhost:5000/conversations" \
  -H "x-user-id: test-user-123" \
  -H "Authorization: Bearer test-token"
```

**Expected Response:**
```json
[
  {
    "id": "conv-123",
    "title": "Paris Trip Planning",
    "createdAt": 1712067600000,
    "updatedAt": 1712067600000
  }
]
```

### Get Conversation with Messages

```bash
curl -X GET "http://localhost:5000/conversations/conv-123" \
  -H "x-user-id: test-user-123" \
  -H "Authorization: Bearer test-token"
```

**Expected Response:**
```json
{
  "conversationId": "conv-123",
  "userId": "test-user-123",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Find a place for 2 in Paris",
      "createdAt": 1712067620000
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "I found 3 listings in Paris...",
      "toolResults": [...],
      "createdAt": 1712067640000
    }
  ]
}
```

### Delete Conversation

```bash
curl -X DELETE "http://localhost:5000/conversations/conv-123" \
  -H "x-user-id: test-user-123" \
  -H "Authorization: Bearer test-token"
```

---

## 5️⃣ Test WebSocket (Agent Backend → Frontend)

### Using WebSocket CLI Tool

```bash
# Install websocat if needed:
# macOS: brew install websocat
# Otherwise use online WebSocket client

# Connect
websocat ws://localhost:5000/socket.io/?EIO=4&transport=websocket

# The socket.io protocol is complex, use browser instead (see below)
```

### Using Browser Console

Open Firefox/Chrome DevTools, paste in console:

```javascript
// Connect
io = await import('socket.io-client').then(m => m.io);
socket = io('http://localhost:5000', {
  auth: { userId: 'test-user-123', token: 'test-token' }
});

// Listen for events
socket.on('connect', () => console.log('Connected'));
socket.on('message_saved', (data) => console.log('Saved:', data));
socket.on('agent_response', (data) => console.log('Response:', data));
socket.on('error', (err) => console.log('Error:', err));

// Send message
socket.emit('send_message', {
  conversationId: 'conv-123',
  content: 'Find a place for 2 in Paris',
  jwtToken: 'test-token'
});
```

---

## 6️⃣ Test Full Chat Flow

### Step 1: Create Conversation (REST)

```bash
CONV_ID=$(curl -s -X POST "http://localhost:5000/conversations" \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -H "Authorization: Bearer test-token" \
  -d '{"title": "Test"}' | jq -r '.id')

echo "Conversation ID: $CONV_ID"
```

### Step 2: Connect WebSocket (Browser)

In browser console:

```javascript
socket = io('http://localhost:5000', {
  auth: { userId: 'test-user-123', token: 'test-token' }
});

socket.on('agent_response', (data) => {
  console.log('Agent Response:', data.content);
  console.log('Tool Results:', data.toolResults);
});

// Send message
socket.emit('send_message', {
  conversationId: 'CONV_ID_HERE',
  content: 'Find a place for 2 people in Paris for 5 days',
  jwtToken: 'test-token'
});
```

### Step 3: Check Firestore Storage

In Firebase Console:
- Go to Firestore Database
- Navigate to `conversations` collection
- Find your conversation ID
- See messages stored

---

## 7️⃣ Test Frontend

### Test Conversation Management

1. Open http://localhost:3000
2. Click "+ New Conversation"
3. Enter "Test Conversation"
4. Should create and show in sidebar
5. Click to select it
6. ChatWindow should load

### Test Chat Sending

1. Type in message box: "Find a place for 2 in Paris"
2. Click send button
3. Message should appear in chat as "user" (blue)
4. Agent should respond with results

### Test Tool Results Display

1. After query, should see:
   - "Found X listings" header
   - Grid of listing cards
   - Each card shows: title, location, capacity, price, rating

### Test Responsive Design

1. Open DevTools (F12)
2. Set device to "iPhone 12"
3. Chat should remain functional
4. Sidebar should adapt to narrow screen

---

## 8️⃣ Integration Test Scenarios

### Scenario A: Simple Query

```
✅ User: "Find a place in Paris"
✅ LLM: Extracts city=Paris
✅ MCP: Calls query_listings(city: "Paris")
✅ API: Returns results
✅ Frontend: Shows results as cards
✅ Firestore: Stores Q&A pair
```

Test Result: **⬜ PASS / ⬜ FAIL**

### Scenario B: Complex Query

```
✅ User: "2 people, Paris, May 1-5, under 150€"
✅ LLM: Extracts city, people, dates, budget
✅ MCP: Calls query_listings with all params
✅ API: Filters results correctly
✅ Frontend: Shows filtered results
✅ Persistence: Stored in Firestore
```

Test Result: **⬜ PASS / ⬜ FAIL**

### Scenario C: Multi-turn Conversation

```
✅ User Q1: "Show me places in Paris"
✅ Agent Response: Shows 10 listings
✅ User Q2: "Can you book the first one?"
✅ Agent: Asks for dates or attempts booking
✅ Firestore: All messages stored with history
```

Test Result: **⬜ PASS / ⬜ FAIL**

### Scenario D: Persistence

```
✅ Create conversation
✅ Send few messages
✅ Refresh browser
✅ Conversation still visible
✅ Messages still there
✅ Load old conversation
```

Test Result: **⬜ PASS / ⬜ FAIL**

---

## 9️⃣ Performance Testing

### Measure LLM Response Time

```bash
# Add to agent-backend logs:
const startTime = Date.now();
const llmResponse = await llmClient.processMessage(...);
const endTime = Date.now();
console.log(`LLM Response Time: ${endTime - startTime}ms`);
```

**Expected**: < 5 seconds

### Measure Tool Execution Time

```bash
console.time('query_listings');
const result = await mcpClient.executeTool('query_listings', ...);
console.timeEnd('query_listings');
```

**Expected**: < 500ms

### Measure Firestore Write Time

```bash
console.time('firestore_save');
await firestoreService.saveMessage(...);
console.timeEnd('firestore_save');
```

**Expected**: < 1000ms

---

## 🔟 Troubleshooting with Tests

### Issue: "Cannot reach API Gateway"

```bash
# Test each layer:
curl http://localhost:4000/api/v1/guest/listings  # Your API
curl http://localhost:8080/api/v1/guest/listings  # Gateway
```

### Issue: "MCP not responding"

```bash
# No direct HTTP test, check logs:
cd mcp-server && npm run dev
# Should show: "Listing MCP server started successfully"
```

### Issue: "Firestore connection failed"

```bash
# Test connection in agent-backend logs
# Look for: "Firebase initialized" or connection errors
# Check firebase credentials in .env
```

### Issue: "WebSocket connection refused"

```bash
# Verify agent backend running
curl http://localhost:5000/health

# Check browser console for detailed error
# Open DevTools → Console tab
```

---

## 📝 Test Report Template

Use this to document your testing:

```markdown
# SE4458 Assignment 2 - Test Report

Date: ________
Tester: ________

## Component Tests

- [ ] MCP Server starts without errors
- [ ] Agent Backend connects to MCP
- [ ] Frontend loads at localhost:3000
- [ ] Firestore authentication works
- [ ] OpenAI/Ollama LLM connection works

## API Tests

- [ ] GET /api/v1/guest/listings returns results
- [ ] GET /conversations returns user's conversations
- [ ] POST /conversations creates new conversation
- [ ] GET /conversations/:id loads messages
- [ ] DELETE /conversations/:id removes conversation

## Chat Flow Tests

- [ ] Can send message via WebSocket
- [ ] Receive agent response
- [ ] LLM correctly interprets intent
- [ ] MCP tools execute successfully
- [ ] Listings display as cards
- [ ] Tool errors handled gracefully

## Persistence Tests

- [ ] Message saved to Firestore
- [ ] Conversation persists after refresh
- [ ] Can load conversation history
- [ ] Multiple conversations work

## Performance Tests

- [ ] LLM response < 5s
- [ ] Tool execution < 500ms
- [ ] Firestore writes < 1000ms
- [ ] WebSocket latency < 100ms

## Notes

_Any issues found:_

_Recommendations:_

---

**Overall Status**: ⬜ PASS / ⬜ FAIL
```

---

**Ready to Test?** Start with section 1️⃣ and work through each component!
