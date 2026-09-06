import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { liveWebSocket } from '../services/liveWebSocket.js';

const LiveWebSocketContext = createContext({
  connectionStatus: 'DISCONNECTED',
  workerStatus: null,
  isLiveProcessing: false,
  latestProcessedEvent: null,
  liveNewsArticles: [],
  latestEvent: null,
  send: () => {},
  reconnect: () => {},
});

export function LiveWebSocketProvider({ children }) {
  const [state, setState] = useState(() => liveWebSocket.getSnapshot());

  useEffect(() => {
    // Connect immediately when the application loads
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

  return (
    <LiveWebSocketContext.Provider
      value={{
        connectionStatus: state.connectionStatus,
        workerStatus: state.workerStatus,
        isLiveProcessing: state.workerStatus?.status === 'processing',
        latestProcessedEvent: state.latestProcessedEvent,
        liveNewsArticles: state.liveNewsArticles,
        latestEvent: state.latestEvent,
        send,
        reconnect,
      }}
    >
      {children}
    </LiveWebSocketContext.Provider>
  );
}

export function useLiveWebSocket() {
  return useContext(LiveWebSocketContext);
}
