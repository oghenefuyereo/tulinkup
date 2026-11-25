"use client";

import {
  blockUser,
  unblockUser,
} from "@/lib/messagingApi";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import ConversationChat from "./ConversationChat";

import {
  useRealtime,
  useRealtimeEvent,
} from "@/context/RealtimeContext";

import {
  MESSAGING_EVENTS,
} from "@/lib/realtimeClient";

import {
  getConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
} from "@/lib/messagingApi";

function mergeMessages(previous, incoming) {
  const merged = new Map();

  for (const message of [...previous, ...incoming]) {
    merged.set(String(message.id), message);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const first = BigInt(a.id);
    const second = BigInt(b.id);

    return first < second ? -1 : first > second ? 1 : 0;
  });
}

export default function ConnectedConversation({
  conversation,
  currentUserId,
  onBack,
  onConversationUpdate,
}) {
  const conversationId = String(conversation.id);

  const [details, setDetails] = useState(conversation);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const historyRef = useRef(null);
  const activeRef = useRef(false);
  const sendingRef = useRef(false);

  const blockPendingRef = useRef(false);
  const [blockPending, setBlockPending] = useState(false);
  const [blockError, setBlockError] = useState("");
  const loadingMoreRef = useRef(false);
  const pendingMessageRef = useRef(null);
  const scrollActionRef = useRef(null);
  const updateRef = useRef(onConversationUpdate);

  const { connected } = useRealtime();

  const messagesRef = useRef([]);
  const readPositionRef = useRef("0");
  const readPendingRef = useRef(false);

  const syncHandlerRef = useRef(null);
  const refreshRequestRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const refreshGenerationRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    updateRef.current = onConversationUpdate;
  }, [onConversationUpdate]);

  useEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
    };
  }, []);

  // Mark messages read only when the latest history is visible.
  async function updateReadPosition(items) {
    const element = historyRef.current;

    if (
      !items.length ||
      !activeRef.current ||
      !element ||
      document.visibilityState !== "visible" ||
      !document.hasFocus() ||
      element.getClientRects().length === 0 ||
      element.scrollHeight -
        element.scrollTop -
        element.clientHeight > 80 ||
      readPendingRef.current
    ) {
      return;
    }

    const latest = items[items.length - 1];

    if (
      BigInt(latest.id) <=
      BigInt(readPositionRef.current)
    ) {
      return;
    }

    readPendingRef.current = true;

    try {
      const result = await markMessagesRead(
        conversationId,
        latest.id
      );

      if (!activeRef.current) return;

      readPositionRef.current =
        String(result.lastReadMessageId);

      updateRef.current?.(conversationId, {
        unread_count: result.unreadCount,
        last_read_message_id: result.lastReadMessageId,
      });
    } catch {
      // Read tracking can be retried later.
    } finally {
      readPendingRef.current = false;
    }
  }

  // Retrieve conversation details and the latest message history.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadConversation() {
      try {
        const [conversationData, historyData] =
          await Promise.all([
            getConversation(conversationId, {
              signal: controller.signal,
            }),
            getMessages(conversationId, {
              limit: 50,
              signal: controller.signal,
            }),
          ]);

        if (!active) return;

        const items = mergeMessages(
          [],
          historyData.messages || []
        );

        readPositionRef.current = String(
          conversationData.conversation.last_read_message_id ||
          "0"
        );

        setDetails(conversationData.conversation);
        setMessages(items);
        setHasMore(Boolean(historyData.hasMore));
        setNextBeforeId(historyData.nextBeforeId ?? null);
        setError("");

        scrollActionRef.current = {
          type: "bottom",
        };

        updateRef.current?.(
          conversationId,
          conversationData.conversation
        );

        // Read tracking runs after the history is rendered.
      } catch (err) {
        if (!active || err.name === "AbortError") return;

        setError(
          err.message || "Unable to load this conversation."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConversation();

    return () => {
      active = false;
      controller.abort();
    };
  }, [conversationId, reloadKey]);

  // Keep the newest messages visible while preserving the
  // scroll position when older messages are loaded.
  useLayoutEffect(() => {
    const element = historyRef.current;
    const action = scrollActionRef.current;

    if (!element || !action || loading) return;

    if (action.type === "bottom") {
      element.scrollTop = element.scrollHeight;
    }

    if (action.type === "preserve") {
      element.scrollTop =
        element.scrollHeight -
        action.previousHeight +
        action.previousTop;
    }

    scrollActionRef.current = null;
  }, [messages, loading]);

  // Synchronize committed messages through the authorized REST API.
  useEffect(() => {
    if (loading || error) return;

    let active = true;

    async function synchronize() {
      if (blockPendingRef.current) return;

      refreshRequestRef.current?.abort();

      const controller = new AbortController();
      refreshRequestRef.current = controller;

      const generation = ++refreshGenerationRef.current;

      try {
        const [conversationData, historyData] =
          await Promise.all([
            getConversation(conversationId, {
              signal: controller.signal,
            }),
            getMessages(conversationId, {
              limit: 100,
              signal: controller.signal,
            }),
          ]);

        const incoming = historyData.messages || [];
        let combined = incoming;

        const existing = messagesRef.current;
        const latestKnown = existing[existing.length - 1];

        // Recover gaps when more than one page was missed.
        let page = historyData;

        while (
          latestKnown &&
          page.hasMore &&
          page.nextBeforeId &&
          combined.length &&
          BigInt(combined[0].id) > BigInt(latestKnown.id)
        ) {
          page = await getMessages(conversationId, {
            limit: 100,
            beforeId: page.nextBeforeId,
            signal: controller.signal,
          });

          combined = mergeMessages(
            page.messages || [],
            combined
          );
        }

        if (
          !active ||
          blockPendingRef.current ||
          controller.signal.aborted ||
          generation !== refreshGenerationRef.current
        ) {
          return;
        }

        const element = historyRef.current;

        const nearBottom = element &&
          element.scrollHeight -
          element.scrollTop -
          element.clientHeight <= 80;

        if (nearBottom && combined.length) {
          scrollActionRef.current = {
            type: "bottom",
          };
        }

        setMessages(previous =>
          mergeMessages(previous, combined)
        );

        // Initialize pagination if the conversation was empty.
        if (!existing.length) {
          setHasMore(Boolean(page.hasMore));
          setNextBeforeId(page.nextBeforeId ?? null);
        }

        setDetails(previous => {
          const next = conversationData.conversation;

          const restricted =
            next.is_blocked ||
            next.accounts_available === false;

          const synchronized = {
            ...next,
            participant_last_read_message_id:
              restricted
                ? null
                : next.participant_last_read_message_id ?? null,
          };

          // Preserve newer locally confirmed messages while
          // accepting authorized read receipts and restrictions.
          if (
            previous.last_message_id &&
            BigInt(previous.last_message_id) >
              BigInt(next.last_message_id || "0")
          ) {
            return {
              ...synchronized,
              last_message_id: previous.last_message_id,
              last_message: previous.last_message,
              last_message_sender_id:
                previous.last_message_sender_id,
              last_message_at: previous.last_message_at,
              updated_at: previous.updated_at,
            };
          }

          return synchronized;
        });

      } catch (err) {
        if (
          active &&
          err.name !== "AbortError"
        ) {
          console.warn(
            "Conversation synchronization unavailable."
          );
        }
      }
    }

    function scheduleRefresh(payload) {
      if (blockPendingRef.current) return;

      if (
        payload?.conversationId != null &&
        String(payload.conversationId) !== conversationId
      ) {
        return;
      }

      clearTimeout(refreshTimerRef.current);

      refreshRequestRef.current?.abort();
      refreshGenerationRef.current += 1;

      refreshTimerRef.current = setTimeout(
        synchronize,
        150
      );
    }

    // Reconcile missed messages after a successful connection.
    if (connected) {
      scheduleRefresh();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener("focus", handleVisibility);

    // Expose the current synchronization handler.
    syncHandlerRef.current = scheduleRefresh;

    return () => {
      active = false;

      clearTimeout(refreshTimerRef.current);
      refreshRequestRef.current?.abort();

      syncHandlerRef.current = null;

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "focus",
        handleVisibility
      );
    };
  }, [conversationId, connected, loading, error]);

  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGE_CREATED,
    payload => syncHandlerRef.current?.(payload)
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.CONVERSATION_UPDATED,
    payload => syncHandlerRef.current?.(payload)
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGES_READ,
    payload => syncHandlerRef.current?.(payload)
  );

  // Update read positions after rendering or returning to the chat.
  useEffect(() => {
    if (loading || error) return;

    const element = historyRef.current;

    function markVisibleMessages() {
      updateReadPosition(messagesRef.current);
    }

    const timer = setTimeout(markVisibleMessages, 100);

    element?.addEventListener(
      "scroll",
      markVisibleMessages,
      { passive: true }
    );

    document.addEventListener(
      "visibilitychange",
      markVisibleMessages
    );

    window.addEventListener("focus", markVisibleMessages);

    return () => {
      clearTimeout(timer);

      element?.removeEventListener(
        "scroll",
        markVisibleMessages
      );

      document.removeEventListener(
        "visibilitychange",
        markVisibleMessages
      );

      window.removeEventListener(
        "focus",
        markVisibleMessages
      );
    };
  }, [messages, loading, error, conversationId]);

  function retryHistory() {
    setLoading(true);
    setError("");
    setHistoryError("");
    setReloadKey(value => value + 1);
  }

  async function loadOlderMessages() {
    if (
      loadingMoreRef.current ||
      !hasMore ||
      !nextBeforeId
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setHistoryError("");

    try {
      const data = await getMessages(conversationId, {
        limit: 50,
        beforeId: nextBeforeId,
      });

      if (!activeRef.current) return;

      const element = historyRef.current;

      if (element) {
        scrollActionRef.current = {
          type: "preserve",
          previousHeight: element.scrollHeight,
          previousTop: element.scrollTop,
        };
      }

      setMessages(previous =>
        mergeMessages(previous, data.messages || [])
      );

      setHasMore(Boolean(data.hasMore));
      setNextBeforeId(data.nextBeforeId ?? null);
    } catch (err) {
      if (activeRef.current) {
        setHistoryError(
          err.message || "Unable to load older messages."
        );
      }
    } finally {
      loadingMoreRef.current = false;

      if (activeRef.current) {
        setLoadingMore(false);
      }
    }
  }

  async function handleBlockChange(shouldBlock) {
    if (
      blockPendingRef.current ||
      typeof shouldBlock !== "boolean"
    ) {
      return false;
    }

    blockPendingRef.current = true;

    clearTimeout(refreshTimerRef.current);
    refreshRequestRef.current?.abort();
    refreshGenerationRef.current += 1;

    setBlockPending(true);
    setBlockError("");

    try {
      const result = shouldBlock
        ? await blockUser(conversationId)
        : await unblockUser(conversationId);

      if (!activeRef.current) return false;

      // Cancel synchronization requests that may contain
      // blocking information from before this operation.
      refreshRequestRef.current?.abort();
      refreshGenerationRef.current += 1;

      const restrictions = {
        is_blocked: result.isBlocked,
        blocked_by_me: result.blockedByMe,
        participant_last_read_message_id: null,
      };

      setDetails(previous => ({
        ...previous,
        ...restrictions,
      }));

      updateRef.current?.(
        conversationId,
        restrictions
      );

      setSendError("");

      return true;
    } catch (err) {
      if (activeRef.current) {
        setBlockError(
          err.message ||
          "Unable to update blocking preferences."
        );
      }

      return false;
    } finally {
      blockPendingRef.current = false;

      if (activeRef.current) {
        setBlockPending(false);

        // Reconcile with the authoritative server state,
        // including independent blocks by either participant.
        syncHandlerRef.current?.();
      }
    }
  }

  async function handleSend(body) {
    if (
      sendingRef.current ||
      blockPendingRef.current ||
      details.is_blocked ||
      details.accounts_available === false
    ) {
      return false;
    }

    sendingRef.current = true;
    setSending(true);
    setSendError("");

    try {
      // Reuse the same UUID when retrying the same message.
      if (
        !pendingMessageRef.current ||
        pendingMessageRef.current.body !== body
      ) {
        pendingMessageRef.current = {
          body,
          clientMessageId: crypto.randomUUID(),
        };
      }

      const result = await sendMessage(
        conversationId,
        pendingMessageRef.current
      );

      if (!activeRef.current) return false;

      const message = result.message;

      if (!message?.id) {
        throw new Error("Message confirmation was unavailable.");
      }

      pendingMessageRef.current = null;

      scrollActionRef.current = {
        type: "bottom",
      };

      setMessages(previous =>
        mergeMessages(previous, [message])
      );

      const latest = {
        last_message_id: message.id,
        last_message: message.body,
        last_message_sender_id: message.sender_id,
        last_message_at: message.created_at,
        updated_at: message.created_at,
      };

      setDetails(previous => ({
        ...previous,
        ...latest,
      }));

      updateRef.current?.(
        conversationId,
        latest
      );

      return true;
    } catch (err) {
      if (activeRef.current) {
        setSendError(
          err.message || "Unable to send your message."
        );
      }

      return false;
    } finally {
      sendingRef.current = false;

      if (activeRef.current) {
        setSending(false);
      }
    }
  }

  return (
    <ConversationChat
      conversation={details}
      messages={messages}
      currentUserId={currentUserId}
      loading={loading}
      error={error}
      hasMore={hasMore}
      loadingMore={loadingMore}
      sending={sending}
      sendError={sendError}
      historyError={historyError}
      onBack={onBack}
      onRetry={retryHistory}
      onLoadMore={loadOlderMessages}
      onSend={handleSend}
      blockPending={blockPending}
      blockError={blockError}
      onBlockChange={handleBlockChange}
      historyRef={historyRef}
    />
  );
}
