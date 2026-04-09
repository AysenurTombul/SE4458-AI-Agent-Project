import React, { useState, useEffect } from 'react';
import { Conversation } from '../types';
import apiClient from '../api';
import './Sidebar.css';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: (title: string) => void;
  onDeleteConversation: (id: string) => void;
  userId: string;
  jwtToken?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  selectedId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  userId,
  jwtToken
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (jwtToken && userId) {
      apiClient.setAuthToken(jwtToken, userId);
    }
  }, [jwtToken, userId]);

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTitle.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      onCreateConversation(newTitle);
      setNewTitle('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>🏠 Listing Agent</h1>
      </div>

      <form onSubmit={handleCreateConversation} className="new-conversation-form">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New conversation name..."
          disabled={isCreating}
          className="new-conversation-input"
        />
        <button type="submit" disabled={isCreating || !newTitle.trim()} className="create-button">
          {isCreating ? '...' : '+'}
        </button>
      </form>

      <div className="conversations-list">
        {conversations.length === 0 ? (
          <div className="empty-conversations">
            <p>No conversations yet</p>
            <p>Create one to get started!</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedId === conversation.id ? 'active' : ''}`}
            >
              <button
                onClick={() => onSelectConversation(conversation.id)}
                className="conversation-button"
              >
                <span className="conversation-title">{conversation.title}</span>
                <span className="conversation-date">
                  {new Date(conversation.createdAt).toLocaleDateString()}
                </span>
              </button>
              <button
                onClick={() => onDeleteConversation(conversation.id)}
                className="delete-button"
                title="Delete conversation"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <p>Welcome, {userId}!</p>
      </div>
    </div>
  );
};

export default Sidebar;
