import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket: Socket | null = null;
type EventCallback = (data: any) => void;

export interface SocketEventHandlers {
  'campaign:created'?: (data: any) => void;
  'campaign:reviewed'?: (data: any) => void;
  'campaign:statusChanged'?: (data: any) => void;
  'donation:received'?: (data: any) => void;
  'donation:refunded'?: (data: any) => void;
  'milestone:confirmed'?: (data: any) => void;
  'milestone:released'?: (data: any) => void;
  'kyc:statusChanged'?: (data: any) => void;
}

/**
 * Initialize Socket.IO connection
 * Call this once at app startup
 */
export const initSocket = (): Socket => {
  if (socket?.connected) {
    console.log('[Socket] Already connected');
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  return socket;
};

/**
 * Get the current socket instance
 */
export const getSocket = (): Socket | null => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a room (e.g., user:{userId}, campaign:{campaignId})
 */
export const joinRoom = (room: string): void => {
  const s = getSocket();
  if (s?.connected) {
    s.emit('join', { room });
    console.log(`[Socket] Joined room: ${room}`);
  }
};

/**
 * Leave a room
 */
export const leaveRoom = (room: string): void => {
  const s = getSocket();
  if (s?.connected) {
    s.emit('leave', { room });
    console.log(`[Socket] Left room: ${room}`);
  }
};

/**
 * Subscribe to a socket event
 */
export const onSocketEvent = <T = any>(event: string, callback: (data: T) => void): void => {
  const s = getSocket();
  if (s) {
    s.on(event, callback);
  }
};

/**
 * Unsubscribe from a socket event
 */
export const offSocketEvent = (event: string, callback?: EventCallback): void => {
  const s = getSocket();
  if (s) {
    if (callback) {
      s.off(event, callback);
    } else {
      s.off(event);
    }
  }
};

/**
 * Subscribe to multiple events at once
 */
export const subscribeToEvents = (handlers: SocketEventHandlers): void => {
  const s = getSocket();
  if (!s) return;

  Object.entries(handlers).forEach(([event, handler]) => {
    if (handler) {
      s.on(event, handler);
    }
  });
};

/**
 * Unsubscribe from multiple events
 */
export const unsubscribeFromEvents = (handlers: SocketEventHandlers): void => {
  const s = getSocket();
  if (!s) return;

  Object.entries(handlers).forEach(([event, handler]) => {
    if (handler) {
      s.off(event, handler);
    }
  });
};

/**
 * Check if socket is connected
 */
export const isConnected = (): boolean => {
  return socket?.connected ?? false;
};

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  onSocketEvent,
  offSocketEvent,
  subscribeToEvents,
  unsubscribeFromEvents,
  isConnected,
};
