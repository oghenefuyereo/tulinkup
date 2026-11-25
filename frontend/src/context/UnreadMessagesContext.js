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
  useRealtime,
  useRealtimeEvent,
} from "@/context/RealtimeContext";

import {
  MESSAGING_EVENTS,
} from "@/lib/realtimeClient";

import {
  getUnreadCount,
} from "@/lib/messagingApi";

const UnreadMessagesContext = createContext(null);

export function UnreadMessagesProvider({ children }) {
  const { user } = useAuth();
  const { connected } = useRealtime();

  const eligible =
    Boolean(user?.id) &&
    ["student", "tutor"].includes(user?.role);

  const identity = eligible
    ? `${user.role}:${user.id}`
    : null;

  const [snapshot, setSnapshot] = useState({
    identity: null,
    unreadCount: 0,
    unreadConversations: 0,
  });

  const refreshHandlerRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    refreshHandlerRef.current?.();
  }, []);

  useEffect(() => {
    if (!identity) return;

    let active = true;
    let timer = null;
    let controller = null;
    let generation = 0;

    async function refresh() {
      if (!active) return;

      controller?.abort();

      const request = new AbortController();
      controller = request;

      const requestGeneration = ++generation;

      try {
        const data = await getUnreadCount({
          signal: request.signal,
        });

        if (
          !active ||
          request.signal.aborted ||
          requestGeneration !== generation
        ) {
          return;
        }

        const unreadCount = Number(data.unreadCount);
        const unreadConversations =
          Number(data.unreadConversations);

        if (
          !Number.isSafeInteger(unreadCount) ||
          unreadCount < 0 ||
          !Number.isSafeInteger(unreadConversations) ||
          unreadConversations < 0
        ) {
          throw new Error("Invalid unread message count.");
        }

        setSnapshot({
          identity,
          unreadCount,
          unreadConversations,
        });
      } catch (error) {
        if (
          active &&
          error.name !== "AbortError"
        ) {
          console.warn(
            "Unread message synchronization unavailable."
          );
        }
      }
    }

    function scheduleRefresh() {
      if (!active) return;

      clearTimeout(timer);

      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, 200);
    }

    refreshHandlerRef.current = scheduleRefresh;

    // Retrieve the initial unread count.
    refresh();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "focus",
      handleVisibility
    );

    window.addEventListener(
      "online",
      scheduleRefresh
    );

    return () => {
      active = false;

      clearTimeout(timer);
      controller?.abort();

      if (
        refreshHandlerRef.current === scheduleRefresh
      ) {
        refreshHandlerRef.current = null;
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "focus",
        handleVisibility
      );

      window.removeEventListener(
        "online",
        scheduleRefresh
      );
    };
  }, [identity]);

  // Refresh when a new message is committed.
  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGE_CREATED,
    refreshUnreadCount
  );

  // Refresh when messages are marked as read.
  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGES_READ,
    refreshUnreadCount
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.UNREAD_UPDATED,
    refreshUnreadCount
  );

  // Recover unread counts after reconnection.
  useEffect(() => {
    if (identity && connected) {
      refreshUnreadCount();
    }
  }, [identity, connected, refreshUnreadCount]);

  // Never expose counts belonging to another account.
  const current =
    identity !== null &&
    snapshot.identity === identity;

  const unreadCount = current
    ? snapshot.unreadCount
    : 0;

  const unreadConversations = current
    ? snapshot.unreadConversations
    : 0;

  const value = useMemo(() => ({
    unreadCount,
    unreadConversations,
    refreshUnreadCount,
  }), [
    unreadCount,
    unreadConversations,
    refreshUnreadCount,
  ]);

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);

  if (!context) {
    throw new Error(
      "useUnreadMessages must be used inside UnreadMessagesProvider."
    );
  }

  return context;
}
