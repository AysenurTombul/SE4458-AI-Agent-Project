import { useState, useEffect } from 'react';

import './App.css';

import Sidebar from './components/Sidebar';

import ChatWindow from './components/ChatWindow';

import { Conversation, Message } from './types';

import apiClient from './api';
import clientSocket from './socket';



const DEMO_USER_ID = 'demo-user-' + Math.random().toString(36).substr(2, 9);

const DEMO_JWT_TOKEN = 'demo-token-' + Math.random().toString(36).substr(2, 20);



function App() {

const [conversations, setConversations] = useState<Conversation[]>([]);

const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

const [isLoadingConversations, setIsLoadingConversations] = useState(true);



// Initialize API client with demo user

useEffect(() => {

apiClient.setAuthToken(DEMO_JWT_TOKEN, DEMO_USER_ID);

clientSocket.connect(DEMO_USER_ID, DEMO_JWT_TOKEN);

loadConversations();

return () => {

clientSocket.disconnect();

};

}, []);



// Load conversations from API

const loadConversations = async () => {

try {

setIsLoadingConversations(true);

const data = await apiClient.getConversations();

setConversations(Array.isArray(data) ? data : []);

} catch (error) {

console.error('Failed to load conversations:', error);

setConversations([]);

} finally {

setIsLoadingConversations(false);

}

};



// Load selected conversation details

useEffect(() => {

if (!selectedConversationId) {

setSelectedConversation(null);

return;

}



const loadConversation = async () => {

try {

const data = await apiClient.getConversation(selectedConversationId);

setSelectedConversation(data);

} catch (error) {

console.error('Failed to load conversation:', error);

}

};



loadConversation();

}, [selectedConversationId]);



// Create new conversation

const handleCreateConversation = async (title: string) => {

try {

const newConversation = await apiClient.createConversation(title);

setConversations((prev) => [newConversation, ...prev]);

setSelectedConversationId(newConversation.id);

} catch (error) {

console.error('Failed to create conversation:', error);

alert('Failed to create conversation');

}

};



// Delete conversation

const handleDeleteConversation = async (id: string) => {

if (!confirm('Are you sure you want to delete this conversation?')) {

return;

}



try {

await apiClient.deleteConversation(id);

setConversations((prev) => prev.filter((c) => c.id !== id));

if (selectedConversationId === id) {

setSelectedConversationId(null);

}

} catch (error) {

console.error('Failed to delete conversation:', error);

alert('Failed to delete conversation');

}

};



if (isLoadingConversations) {

return (

<div className="app loading">

<div className="loader">Loading conversations...</div>

</div>

);

}



// If no conversation is selected, show welcome screen

if (!selectedConversationId) {

return (

<div className="app">

<Sidebar

conversations={conversations}

selectedId={selectedConversationId}

onSelectConversation={setSelectedConversationId}

onCreateConversation={handleCreateConversation}

onDeleteConversation={handleDeleteConversation}

userId={DEMO_USER_ID}

jwtToken={DEMO_JWT_TOKEN}

/>

<div className="main-content welcome">

<div className="welcome-content">

<h1>🏠 Welcome to Listing Agent</h1>

<p>An AI-powered assistant for finding accommodations</p>

<div className="feature-list">

<h3>How it works:</h3>

<ul>

<li>✨ Ask in natural language: "Find a place for 2 people in Paris"</li>

<li>🤖 AI understands your request and searches our database</li>

<li>📍 Get personalized accommodation recommendations</li>

<li>💬 Book directly through the chat interface</li>

</ul>

</div>

<p className="hint">➡️ Create a new conversation to get started!</p>

</div>

</div>

</div>

);

}



return (

<div className="app">

<Sidebar

conversations={conversations}

selectedId={selectedConversationId}

onSelectConversation={setSelectedConversationId}

onCreateConversation={handleCreateConversation}

onDeleteConversation={handleDeleteConversation}

userId={DEMO_USER_ID}

jwtToken={DEMO_JWT_TOKEN}

/>

<div className="main-content">

{selectedConversation && (

<ChatWindow

conversationId={selectedConversationId}

userId={DEMO_USER_ID}

jwtToken={DEMO_JWT_TOKEN}

initialMessages={selectedConversation.messages as Message[]}

/>

)}

</div>

</div>

);

}



export default App;