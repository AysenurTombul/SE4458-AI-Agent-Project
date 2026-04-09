import React from 'react';
import { Message, Listing, ToolResult } from '../types';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const renderListingResults = (toolResults: ToolResult[] | undefined) => {
    if (!toolResults) return null;

    return toolResults.map((result, idx) => {
      if (result.toolName === 'query_listings' && result.result && typeof result.result === 'object') {
        const queryResult = result.result as any;
        if (queryResult.items && Array.isArray(queryResult.items)) {
          return (
            <div key={idx} className="listings-container">
              <h4>Found {queryResult.total} listings:</h4>
              <div className="listings-grid">
                {queryResult.items.map((listing: Listing) => (
                  <div key={listing.id} className="listing-card">
                    <h5>{listing.title}</h5>
                    <p className="location">
                      📍 {listing.city}, {listing.country}
                    </p>
                    <p className="capacity">👥 Capacity: {listing.capacity} people</p>
                    <p className="price">💰 ${listing.price}/night</p>
                    {listing.ratingAverage > 0 && (
                      <p className="rating">⭐ {listing.ratingAverage.toFixed(1)}/5</p>
                    )}
                    {listing.amenities && listing.amenities.length > 0 && (
                      <p className="amenities">🏠 {listing.amenities.slice(0, 3).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
      }

      if (result.error) {
        return (
          <div key={idx} className="error-message">
            <strong>❌ {result.toolName} failed:</strong> {result.error}
          </div>
        );
      }

      return null;
    });
  };

  const renderToolStatus = (toolResults: ToolResult[] | undefined) => {
    if (!toolResults) return null;

    return toolResults.map((result, idx) => (
      <div key={idx} className="tool-status">
        {result.error ? (
          <span className="tool-error">⚠️ {result.toolName}: Error</span>
        ) : (
          <span className="tool-success">✓ {result.toolName}: Success</span>
        )}
      </div>
    ));
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        <p>{message.content}</p>

        {message.toolResults && message.toolResults.length > 0 && (
          <div className="tool-results">
            <div className="tool-statuses">{renderToolStatus(message.toolResults)}</div>
            {renderListingResults(message.toolResults)}
          </div>
        )}
      </div>

      <span className="message-timestamp">
        {new Date(message.createdAt).toLocaleTimeString()}
      </span>
    </div>
  );
};

export default MessageBubble;
