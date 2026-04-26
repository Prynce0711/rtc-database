"use client";
import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { useWebSocket } from "./hooks/useWebsocket";
import {
  AnySocketEvent,
  SocketError,
  SocketEvent,
  SocketEventPayload,
  SocketEventType,
} from "./SocketEvents";

interface Prop {
  children: ReactNode;
}

interface SocketContextType {
  socket: WebSocket | null;
  onRecieveData: (handler: (data: AnySocketEvent) => void) => () => void;
  onRecieveError: (handler: (error: SocketError) => void) => () => void;
  send: <T extends SocketEventType>(
    event: T,
    payload: SocketEventPayload<T>,
  ) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

const SocketProvider = ({ children }: Prop) => {
  const url = () =>
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/user/socket`;
  const { socket } = useWebSocket(url, {
    reconnect: true,
    reconnectIntervalMs: 5000,
  });

  const recieveDataHandlersRef = useRef<Set<(data: AnySocketEvent) => void>>(
    new Set(),
  );

  const recieveErrorHandlersRef = useRef<Set<(error: SocketError) => void>>(
    new Set(),
  );

  useEffect(() => {
    if (socket) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const socketEvent: AnySocketEvent = JSON.parse(event.data);
          if (socketEvent.type === SocketEventType.ERROR) {
            recieveErrorHandlersRef.current.forEach((handler) => {
              handler(socketEvent.payload as SocketError);
            });
            console.warn("Socket error received:", event.data as SocketError);
            return;
          }

          recieveDataHandlersRef.current.forEach((handler) => {
            handler(socketEvent);
          });
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.addEventListener("message", handleMessage);

      return () => {
        socket.removeEventListener("message", handleMessage);
      };
    }
  }, [socket]);

  const onRecieveData = (handler: (data: AnySocketEvent) => void) => {
    recieveDataHandlersRef.current.add(handler);

    // Return cleanup function
    return () => {
      recieveDataHandlersRef.current.delete(handler);
    };
  };

  const onRecieveError = (handler: (error: SocketError) => void) => {
    recieveErrorHandlersRef.current.add(handler);

    // Return cleanup function
    return () => {
      recieveErrorHandlersRef.current.delete(handler);
    };
  };

  const send = <T extends SocketEventType>(
    event: T,
    payload: SocketEventPayload<T>,
  ) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("Socket not open. Cannot send message.");
      return;
    }

    const socketEvent: SocketEvent<T> = { type: event, payload };
    socket.send(JSON.stringify(socketEvent));
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onRecieveData,
        onRecieveError,
        send,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
