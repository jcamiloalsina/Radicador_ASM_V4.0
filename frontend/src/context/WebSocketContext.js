import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const listenersRef = useRef(new Set());

  // Get WebSocket URL from environment
  const getWsUrl = useCallback(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    // Convert http(s) to ws(s)
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = backendUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${baseUrl}/ws/${user?.id}`;
  }, [user?.id]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!user?.id) return;
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      const wsUrl = getWsUrl();
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data);
          setLastMessage(data);
          
          // Notify all listeners
          listenersRef.current.forEach(listener => {
            try {
              listener(data);
            } catch (err) {
              console.error('[WebSocket] Listener error:', err);
            }
          });

          // Handle specific message types with toasts
          if (data.type === 'cambio_predio') {
            const action = data.action === 'aprobado' ? '✅ aprobado' : '❌ rechazado';
            toast.info(
              `Cambio ${action} por ${data.decidido_por}`,
              {
                description: `Predio: ${data.codigo_predio}`,
                action: {
                  label: 'Sincronizar',
                  onClick: () => {
                    // Dispatch a custom event that components can listen to
                    window.dispatchEvent(new CustomEvent('syncPredios', { detail: data }));
                  }
                },
                duration: 10000
              }
            );
          }
        } catch (err) {
          console.error('[WebSocket] Error parsing message:', err);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Reconnect after 5 seconds if not a clean close
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting reconnect...');
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

    } catch (err) {
      console.error('[WebSocket] Connection error:', err);
    }
  }, [user?.id, getWsUrl]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User logout');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Add a message listener
  const addListener = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Send a message (for ping/pong)
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);

  // Connect when user logs in
  useEffect(() => {
    if (user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage('ping');
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  const value = {
    isConnected,
    lastMessage,
    addListener,
    sendMessage
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
