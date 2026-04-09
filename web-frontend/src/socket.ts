import io, { Socket } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5001';

class ClientSocket {
  private socket: Socket | null = null;

  connect(userId: string, jwtToken?: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(BACKEND_URL, {
      auth: {
        userId,
        token: jwtToken
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(conversationId: string, content: string, jwtToken?: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('send_message', {
      conversationId,
      content,
      jwtToken
    });
  }

  loadConversation(conversationId: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('load_conversation', conversationId);
  }

  onMessageSaved(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('message_saved', callback);
  }

  onAgentResponse(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('agent_response', callback);
  }

  onToolExecuted(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('tool_executed', callback);
  }

  onConversationLoaded(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('conversation_loaded', callback);
  }

  onError(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('error', callback);
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new ClientSocket();
