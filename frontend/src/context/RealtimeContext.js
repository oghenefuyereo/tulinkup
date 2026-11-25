"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "@/context/AuthContext";

import {
  createRealtimeClient,
  MESSAGING_EVENTS,
} from "@/lib/realtimeClient";

const RealtimeContext = createContext(null);

const allowedEvents = new Set(
  Object.values(MESSAGING_EVENTS)
);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();

  const userId = user?.id
    ? String(user.id)
    : null;

  const role = user?.role ?? null;

  const eligible =
    Boolean(userId) &&
    ["student", "tutor"].includes(role);

  const identity = eligible
    ? `${role}:${userId}`
    : null;

  const [connection, setConnection] = useState({
    identity: null,
    status: "disconnected",
  });

  const listeners = useRef(new Map());
  const clientRef = useRef(null);

  // Send temporary typing activity through
  // the current authenticated connection.
  const sendTyping = useCallback(
    (conversationId, isTyping) => {
      const current = clientRef.current;

      if (
        !identity ||
        !current ||
        current.identity !== identity
      ) {
        return false;
      }

      return current.client.sendTyping(
        conversationId,
        isTyping
      );
    },
    [identity]
  );

  // Allow components to subscribe to approved events.
  const subscribe = useCallback((event, listener) => {
    if (
      !allowedEvents.has(event) ||
      typeof listener !== "function"
    ) {
      throw new Error(
        "Invalid real-time event subscription."
      );
    }

    let subscribers = listeners.current.get(event);

    if (!subscribers) {
      subscribers = new Set();
      listeners.current.set(event, subscribers);
    }

    subscribers.add(listener);

    return () => {
      subscribers.delete(listener);

      if (
        subscribers.size === 0 &&
        listeners.current.get(event) === subscribers
      ) {
        listeners.current.delete(event);
      }
    };
  }, []);

  // Deliver events without allowing one subscriber
  // failure to interrupt other subscribers.
  const dispatchEvent = useCallback((event, payload) => {
    if (!allowedEvents.has(event)) {
      return;
    }

    const subscribers = listeners.current.get(event);

    if (!subscribers) {
      return;
    }

    for (const listener of [...subscribers]) {
      try {
        listener(payload);
      } catch {
        console.warn(
          "Real-time event subscriber failed."
        );
      }
    }
  }, []);

  // Maintain the connection for the authenticated identity.
  useEffect(() => {
    if (!identity) {
      return;
    }

    let active = true;
    let client = null;

    function updateStatus(status) {
      if (active) {
        setConnection({
          identity,
          status,
        });
      }
    }

    try {
      client = createRealtimeClient({
        onStatus: updateStatus,

        onEvent(event, payload) {
          if (active) {
            dispatchEvent(event, payload);
          }
        },
      });

      clientRef.current = {
        identity,
        client,
      };

      client.connect();
    } catch {
      updateStatus("unavailable");
    }

    // Disconnect on logout, account changes,
    // or provider unmount.
    return () => {
      active = false;

      if (clientRef.current?.client === client) {
        clientRef.current = null;
      }

      client?.stop();
    };
  }, [identity, dispatchEvent]);

  const status = !identity
    ? "disconnected"
    : connection.identity === identity
      ? connection.status
      : "connecting";

  const value = useMemo(() => ({
    status,
    connected: status === "connected",
    subscribe,
    sendTyping,
  }), [status, subscribe, sendTyping]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error(
      "useRealtime must be used inside RealtimeProvider."
    );
  }

  return context;
}

// Subscribe to an event and automatically
// remove the subscription on component unmount.
export function useRealtimeEvent(event, handler) {
  const { subscribe } = useRealtime();

  useEffect(() => {
    if (typeof handler !== "function") {
      return;
    }

    return subscribe(event, handler);
  }, [event, handler, subscribe]);
}
