import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { liveWebSocket, WS_URL } from '../services/liveWebSocket.js';

const LiveWebSocketContext = createContext({
  connectionStatus: 'disconnected', // 'connected' | 'connecting' | 'disconnected' | 'error'
  isConnected: false,
  workerStatus: null,
  isLiveProcessing: false,
  latestProcessedEvent: null,
  liveNewsArticles: [],
  latestEvent: null,
  lastPong: null,
  lastError: null,
  send: () => {},
  reconnect: () => {},
  disconnect: () => {},
});

/**
 * Shared Application Provider for Live WebSocket Stream.
 * Automatically connects when mounted (app startup) and provides shared
 * real-time event streaming across all platform views.
 */
export function LiveWebSocketProvider({ children }) {
  const [state, setState] = useState(() => liveWebSocket.getSnapshot());

  useEffect(() => {
    // Connect immediately when the application or dashboard mounts
    liveWebSocket.connect();

    const unsubscribe = liveWebSocket.subscribe((event, snapshot) => {
      setState(snapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const send = useCallback((msg) => liveWebSocket.send(msg), []);
  const reconnect = useCallback(() => liveWebSocket.connect(), []);
  const disconnect = useCallback(() => liveWebSocket.disconnect(), []);

  return (
    <LiveWebSocketContext.Provider
      value={{
        connectionStatus: state.connectionStatus, // 'connected' | 'connecting' | 'disconnected' | 'error'
        isConnected: state.connectionStatus === 'connected',
        workerStatus: state.workerStatus,
        isLiveProcessing: state.workerStatus?.status === 'processing',
        latestProcessedEvent: state.latestProcessedEvent,
        liveNewsArticles: state.liveNewsArticles,
        latestEvent: state.latestEvent,
        lastPong: state.lastPong,
        lastError: state.lastError,
        send,
        reconnect,
        disconnect,
      }}
    >
      {children}
    </LiveWebSocketContext.Provider>
  );
}

/**
 * Access the shared WebSocket state and methods across components.
 */
export function useLiveWebSocket() {
  return useContext(LiveWebSocketContext);
}

/**
 * Reusable WebSocket hook for component-level usage with optional lifecycle callbacks.
 * Connects automatically on mount, reconnects safely, handles worker_status,
 * live_news_processed, error, and pong events, and cleans up on unmount.
 */
export function useWebSocket({
  autoConnect = true,
  onEvent,
  onNewsProcessed,
  onWorkerStatus,
  onError,
  onPong,
} = {}) {
  const [state, setState] = useState(() => liveWebSocket.getSnapshot());

  useEffect(() => {
    if (autoConnect) {
      liveWebSocket.connect();
    }

    const unsubscribe = liveWebSocket.subscribe((event, snapshot) => {
      setState(snapshot);
      if (onEvent) onEvent(event, snapshot);
      if (event.type === 'live_news_processed' && onNewsProcessed) {
        onNewsProcessed(event, snapshot);
      }
      if (event.type === 'worker_status' && onWorkerStatus) {
        onWorkerStatus(event, snapshot);
      }
      if (event.type === 'error' && onError) {
        onError(event, snapshot);
      }
      if (event.type === 'pong' && onPong) {
        onPong(event, snapshot);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [autoConnect, onEvent, onNewsProcessed, onWorkerStatus, onError, onPong]);

  const send = useCallback((msg) => liveWebSocket.send(msg), []);
  const reconnect = useCallback(() => liveWebSocket.connect(), []);
  const disconnect = useCallback(() => liveWebSocket.disconnect(), []);

  return {
    connectionStatus: state.connectionStatus, // 'connected' | 'connecting' | 'disconnected' | 'error'
    isConnected: state.connectionStatus === 'connected',
    workerStatus: state.workerStatus,
    isLiveProcessing: state.workerStatus?.status === 'processing',
    latestProcessedEvent: state.latestProcessedEvent,
    liveNewsArticles: state.liveNewsArticles,
    latestEvent: state.latestEvent,
    lastPong: state.lastPong,
    lastError: state.lastError,
    wsUrl: WS_URL,
    send,
    reconnect,
    disconnect,
  };
}
