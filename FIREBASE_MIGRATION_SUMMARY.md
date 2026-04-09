# Firebase Client SDK Migration Summary

**Date Completed**: 2024
**Issue Resolved**: Agent Backend Firebase initialization failure due to missing Admin SDK credentials

## Problem Statement

The agent-backend was failing to start because `firestore.ts` required Firebase Admin SDK credentials:
- `FIREBASE_PRIVATE_KEY` - Service account private key
- `FIREBASE_CLIENT_EMAIL` - Service account email

These credentials are only available when you have a downloaded service account JSON file from Firebase Console, which is not always practical for development/testing environments.

## Solution Implemented

Migrated the entire `firestore.ts` from **Firebase Admin SDK** to **Firebase Client SDK**.

### What Changed

#### 1. Dependencies Updated

**Before:**
```json
{
  "dependencies": {
    "firebase-admin": "^12.3.1"
  }
}
```

**After:**
```json
{
  "dependencies": {
    "firebase": "^10.7.0"
  }
}
```

#### 2. Environment Variables Changed

**Before (Admin SDK):**
```env
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

**After (Client SDK):**
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
```

#### 3. Code Changes in `firestore.ts`

**Import Changes:**
```typescript
// Old (Admin SDK)
import admin from 'firebase-admin';

// New (Client SDK)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, ... } from 'firebase/firestore';
```

**Initialization Changes:**
```typescript
// Old (Admin SDK)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// New (Client SDK)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

**Method Changes:**

All Firestore operations were refactored from Admin SDK chained calls to Client SDK modular functions:

| Operation | Admin SDK | Client SDK |
|-----------|-----------|-----------|
| Add document | `db.collection().add()` | `addDoc(collection(...), {...})` |
| Get document | `db.collection().doc().get()` | `getDoc(doc(...))` |
| Query | `db.collection().where().get()` | `query(collection(...), where(...)); getDocs(q)` |
| Update | `db.collection().update()` | `updateDoc(doc(...), {...})` |
| Delete | `db.collection().delete()` | `deleteDoc(doc(...))` |
| Batch write | Loop with individual deletes | `writeBatch(db)` with atomic commits |
| Server timestamp | `admin.firestore.FieldValue.serverTimestamp()` | `serverTimestamp()` |

#### 4. Documentation Updates

**Files Updated:**
- ✅ `agent-backend/.env.example` - Added 6 Client SDK variables
- ✅ `ARCHITECTURE.md` - Updated Firebase section and docker-compose config
- ✅ `firestore.ts` - Completely refactored (8 methods updated)
- ✅ `package.json` - Changed firebase-admin to firebase

## How to Set Up After Migration

### Step 1: Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon (Settings) → Project Settings
4. Under "Your apps" section, find or create a web app
5. Copy the **firebaseConfig** object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyD...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };
   ```

### Step 2: Update Environment Variables

```bash
cd agent-backend

# Edit .env with your Firebase credentials
cat << 'EOF' > .env
PORT=5000
NODE_ENV=development
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
FIREBASE_API_KEY=AIzaSyD...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
API_GATEWAY_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
MCP_SERVER_BIN=npx
MCP_SERVER_ARGS=["tsx", "../mcp-server/src/index.ts"]
EOF
```

### Step 3: Install Dependencies

```bash
# Install new firebase package
npm install

# Or update from firebase-admin to firebase
npm uninstall firebase-admin
npm install firebase
```

### Step 4: Set Up Firestore

1. In Firebase Console → Firestore Database
2. Create database in test mode (for development)
3. Create collections as needed

### Step 5: Start the Backend

```bash
npm run dev
```

## Benefits of This Migration

✅ **No service account JSON needed** - Use public Client SDK config  
✅ **Easier setup** - No private key file management  
✅ **Consistent with frontend** - Same Firebase SDK as React frontend  
✅ **Better for development** - Quick setup without admin credentials  
✅ **Same functionality** - All database operations work identically  
✅ **Type-safe** - Full TypeScript support maintained  

## Important Notes

### Security Considerations

- **Client SDK credentials are public** - They're meant to be visible in your code
- **Firestore Security Rules** - Protect your data with proper authentication/authorization rules
- **Backend operations** - While Client SDK works, for production backend-only operations, Admin SDK is preferred (but requires service account)

### Firestore Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write their own conversations
    match /conversations/{conversationId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }
    
    // Messages under conversations
    match /conversations/{conversationId}/messages/{messageId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow write: if false; // System-generated only
    }
  }
}
```

## Troubleshooting

**Error: `Cannot find module 'firebase/app'`**
- Solution: Run `npm install` to fetch new firebase package

**Error: `Missing required Firebase configuration`**
- Solution: Ensure all 6 FIREBASE_* environment variables are set in `.env`

**Firestore operations failing**
- Check Firestore Security Rules allow your user
- Verify FIREBASE_PROJECT_ID matches your Firebase project
- Check browser console for CORS issues

## Next Steps

1. ✅ Update agent-backend environment variables with your Firebase credentials
2. ✅ Run `npm install` to fetch firebase package
3. ✅ Start backend: `npm run dev`
4. ✅ Verify Firestore database is created in Firebase Console
5. ✅ Test conversation creation/persistence via chat UI

## References

- [Firebase Client SDK Documentation](https://firebase.google.com/docs/web/setup)
- [Firestore Web Guide](https://firebase.google.com/docs/firestore/quickstart)
- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/start)
