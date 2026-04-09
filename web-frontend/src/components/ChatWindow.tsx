import React, { useState, useRef, useEffect } from 'react';
import clientSocket from '../socket';
import './ChatWindow.css';
import MessageBubble from './MessageBubble';
import { Message } from '../types';

interface ChatWindowProps {
  conversationId: string;
  userId: string;
  jwtToken?: string;
  initialMessages?: Message[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  userId,
  jwtToken,
  initialMessages = []
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connect socket if not already connected
    const socket = clientSocket.connect(userId, jwtToken);
    setIsConnected(socket.connected);

    // Set up event listeners
    const handleMessageSaved = (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          conversationId,
          userId,
          role: 'user',
          content: data.content || input,
          createdAt: Date.now()
        }
      ]);
      setIsLoading(true);
    };

    const handleAgentResponse = (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          conversationId,
          userId,
          role: 'assistant',
          content: data.content,
          toolResults: data.toolResults,
          createdAt: Date.now()
        }
      ]);
      setIsLoading(false);
      setInput('');
    };

    const handleError = (data: any) => {
      console.error('Chat error:', data.message);
      setIsLoading(false);
    };

    clientSocket.onMessageSaved(handleMessageSaved);
    clientSocket.onAgentResponse(handleAgentResponse);
    clientSocket.onError(handleError);

    return () => {
      clientSocket.removeAllListeners();
    };
  }, [conversationId, userId, jwtToken, input]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !isConnected) {
      return;
    }

    try {
      setIsLoading(true);
      clientSocket.sendMessage(conversationId, input, jwtToken);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-window">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>Welcome! 👋</p>
            <p>Start by asking for accommodation in any city. For example:</p>
            <p className="example">"Find accommodation for 2 people in Paris for 5 days"</p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Agent is processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about listings..."
          disabled={!isConnected || isLoading}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!isConnected || isLoading || !input.trim()}
          className="send-button"
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </form>

      {!isConnected && <div className="connection-warning">Connecting...</div>}
    </div>
  );
};

export default ChatWindow;
