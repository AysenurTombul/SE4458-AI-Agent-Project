import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { config } from 'dotenv';

config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase app and db
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export class FirestoreService {
  /**
   * Save a chat message to Firestore
   */
  async saveMessage(conversationId: string, userId: string, message: any) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const payload: Record<string, unknown> = {
      role: message.role,
      content: message.content,
      userId,
      createdAt: serverTimestamp()
    };

    if (Array.isArray(message.toolCalls)) {
      payload.toolCalls = message.toolCalls;
    }

    if (Array.isArray(message.toolResults)) {
      payload.toolResults = message.toolResults;
    }

    await addDoc(messagesRef, payload);
  }

  /**
   * Get specific conversation messages (Simplified to avoid indexing errors)
   */
  async getConversation(conversationId: string, userId: string) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const snapshot = await getDocs(messagesRef);
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { conversationId, userId, messages };
  }

  /**
   * Fetch all conversations for a specific user
   */
  async getUserConversations(userId: string) {
    const conversationsRef = collection(db, 'conversations');
    const q = query(conversationsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Create a new chat session
   */
  async createConversation(userId: string, title: string) {
    const conversationsRef = collection(db, 'conversations');
    const docRef = await addDoc(conversationsRef, {
      userId,
      title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  /**
   * Update conversation data
   */
  async updateConversation(conversationId: string, userId: string, updates: any) {
    const docRef = doc(db, 'conversations', conversationId);
    await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  }

  /**
   * Delete conversation and nested messages
   */
  async deleteConversation(conversationId: string, userId: string) {
    const docRef = doc(db, 'conversations', conversationId);
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    batch.delete(docRef);
    await batch.commit();
  }
}

export default new FirestoreService();