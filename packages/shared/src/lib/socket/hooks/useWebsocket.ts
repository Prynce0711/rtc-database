"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBackendUrl, useSession } from "../../authClient";

// TODO: Stop from disconnecting when moving out of the page, and instead only disconnect when logging out

interface UseWebSocketOptions {
  reconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
  error: string | null;
}

export function resolveSocketUrlFromBackend(backendUrl: string): string {
  const parsed = new URL(backendUrl);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}/api/user/socket`;
}

export function useWebSocket(
  urlFn: () => string = () => resolveSocketUrlFromBackend(getBackendUrl()),
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    reconnect = true,
    reconnectIntervalMs = 5000,
    maxReconnectAttempts = 0, // 0 means unlimited attempts
  } = options;

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const initConnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const { data: session } = useSession();

  const connect = useCallback(() => {
    if (socketRef.current) return;

    if (!session) {
      console.log("[WebSocket] Skipping connect: user not authenticated");
      return;
    }

    const user = session.user as { banned?: boolean };
    if (user.banned) {
      console.log("[WebSocket] Skipping connect: user is banned");
      return;
    }

    const socket = new WebSocket(urlFn());
    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      console.log("[WebSocket] Connected");
    };
    socket.onclose = (event) => {
      console.log("[WebSocket] Closed", event);
      console.log(event.code, event.reason);
      setIsConnected(false);
      socketRef.current = null;
      if (event.code !== 1000) {
        // Only set error if the closure was not intentional (code 1000 means normal closure)
        console.log("WebSocket connection closed unexpectedly.");
      }
      if (
        reconnect &&
        session && // only reconnect if still authenticated
        (maxReconnectAttempts === 0 ||
          reconnectAttempts.current < maxReconnectAttempts)
      ) {
        const delay =
          reconnectIntervalMs * 2 ** reconnectAttempts.current > 10000
            ? 10000
            : reconnectIntervalMs * 2 ** reconnectAttempts.current;
        reconnectAttempts.current += 1;
        console.log(
          `[WebSocket] Attempting reconnect #${reconnectAttempts.current} in ${delay}ms`,
        );
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
    socket.onerror = (event) => {
      console.error("[WebSocket] Error:", event);
      setError("WebSocket encountered an error.");
    };
    socketRef.current = socket;
  }, [urlFn, reconnect, reconnectIntervalMs, maxReconnectAttempts, session]);

  const disconnect = useCallback(() => {
    reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
    reconnectTimeout.current = null;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsConnected(false);
    console.log("[WebSocket] Manually disconnected");
  }, []);

  useEffect(() => {
    if (session && !socketRef.current) {
      // wait a tick to avoid blocking render
      initConnectTimeout.current = setTimeout(() => {
        // double-check current state before connecting
        if (session && !socketRef.current) {
          connect();
        }
        initConnectTimeout.current = null;
      }, 50);
    } else if (!session) {
      disconnect();
    }

    // clear only the scheduled initial connect when deps change
    return () => {
      if (initConnectTimeout.current) {
        clearTimeout(initConnectTimeout.current);
        initConnectTimeout.current = null;
      }
    };
  }, [connect, disconnect]);

  // Ensure we disconnect when the component unmounts.
  useEffect(() => {
    return () => {
      // clear any pending initial connect and disconnect socket
      if (initConnectTimeout.current) {
        clearTimeout(initConnectTimeout.current);
        initConnectTimeout.current = null;
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    socket: socketRef.current,
    connect,
    disconnect,
    isConnected,
    error,
  };
}
