"use client";

import Link from "next/link";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import {
  useRealtime,
  useRealtimeEvent,
} from "@/context/RealtimeContext";

import {
  MESSAGING_EVENTS,
} from "@/lib/realtimeClient";
import ConversationInbox from "./ConversationInbox";
import {
  listConversations,
  getConversation,
} from "@/lib/messagingApi";
import ConnectedConversation from "./ConnectedConversation";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";

function WorkspaceState({
  title,
  description,
  children,
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-[#e3e7ef] bg-white p-6 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#edf1fa] text-[#26469b]">
        <Icon name="message" className="h-8 w-8" />
      </div>

      <h2 className="text-xl font-bold text-[#17233d]">
        {title}
      </h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[#68758c]">
        {description}
      </p>

      {children && (
        <div className="mt-5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MessagingWorkspace({
  initialConversationId = null,
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <WorkspaceState
          title="Loading messages"
          description="Checking your account..."
        />
      </div>
    );
  }

  if (!user) {
    return (
      <WorkspaceState
        title="Log in to your messages"
        description="Sign in to connect with your tutors and students."
      >
        <Link href="/login" className="btn-primary">
          Log in
        </Link>
      </WorkspaceState>
    );
  }

  if (!["student", "tutor"].includes(user.role)) {
    return (
      <WorkspaceState
        title="Messaging unavailable"
        description="Private messaging is available to student and tutor accounts."
      >
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </WorkspaceState>
    );
  }

  return (
    <AuthenticatedWorkspace
      key={`${user.role}:${user.id}:${initialConversationId || "inbox"}`}
      user={user}
      initialConversationId={initialConversationId}
    />
  );
}


function AuthenticatedWorkspace({
  user,
  initialConversationId,
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectionError, setSelectionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paginationError, setPaginationError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { connected } = useRealtime();

  const refreshTimer = useRef(null);
  const refreshController = useRef(null);

  // Real-time inbox synchronization.
  const scheduleInboxRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);

    refreshTimer.current = setTimeout(async () => {
      refreshController.current?.abort();

      const controller = new AbortController();
      refreshController.current = controller;

      try {
        const data = await listConversations({
          limit: 30,
          offset: 0,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const incoming = Array.isArray(data.conversations)
          ? data.conversations
          : [];

        setConversations(previous => {
          const merged = new Map(
            previous.map(item => [String(item.id), item])
          );

          for (const item of incoming) {
            merged.set(String(item.id), item);
          }

          return Array.from(merged.values()).sort(
            (first, second) => {
              const difference =
                new Date(second.updated_at).getTime() -
                new Date(first.updated_at).getTime();

              if (difference) return difference;

              const firstId = BigInt(first.id);
              const secondId = BigInt(second.id);

              return firstId > secondId
                ? -1
                : firstId < secondId
                  ? 1
                  : 0;
            }
          );
        });

        setError("");

        // Refresh the pagination boundary.
        setHasMore(Boolean(data.hasMore));
        setNextOffset(data.nextOffset ?? 0);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Inbox synchronization unavailable.");
        }
      }
    }, 250);
  }, []);

  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGE_CREATED,
    scheduleInboxRefresh
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.CONVERSATION_UPDATED,
    scheduleInboxRefresh
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.MESSAGES_READ,
    scheduleInboxRefresh
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.UNREAD_UPDATED,
    scheduleInboxRefresh
  );

  // Recover updates missed while disconnected.
  useEffect(() => {
    if (connected && !loading) {
      scheduleInboxRefresh();
    }
  }, [connected, loading, scheduleInboxRefresh]);

  // Cancel pending synchronization on unmount.
  useEffect(() => {
    return () => {
      clearTimeout(refreshTimer.current);
      refreshController.current?.abort();
    };
  }, []);

  // Load conversations for the authenticated account.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadInbox() {
      try {
        const data = await listConversations({
          limit: 30,
          offset: 0,
          signal: controller.signal,
        });

        if (!active) return;

        let items = Array.isArray(data.conversations)
          ? data.conversations
          : [];

        let requestedConversation = null;
        let requestedError = "";

        if (initialConversationId) {
          requestedConversation = items.find(
            item =>
              String(item.id) === initialConversationId
          );

          if (!requestedConversation) {
            try {
              const result = await getConversation(
                initialConversationId,
                { signal: controller.signal }
              );

              requestedConversation = result.conversation;

              if (
                !requestedConversation ||
                String(requestedConversation.id) !==
                  initialConversationId
              ) {
                throw new Error("Conversation unavailable.");
              }

              items = [
                requestedConversation,
                ...items,
              ];
            } catch (err) {
              if (err.name === "AbortError") throw err;

              requestedConversation = null;
              requestedError =
                "Unable to open the requested conversation.";
            }
          }
        }

        if (!active) return;

        setConversations(items);
        setSelectionError(requestedError);

        if (requestedConversation) {
          setSelectedId(requestedConversation.id);
        }

        setHasMore(Boolean(data.hasMore));
        setNextOffset(data.nextOffset ?? 0);
        setError("");
      } catch (err) {
        if (!active || err.name === "AbortError") return;

        setConversations([]);
        setHasMore(false);
        setError(
          err.message || "Unable to load conversations."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInbox();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, initialConversationId]);

  function retryInbox() {
    setLoading(true);
    setError("");
    setPaginationError("");
    setSelectedId(null);
    setReloadKey(value => value + 1);
  }

  async function loadMoreConversations() {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setPaginationError("");

    try {
      const data = await listConversations({
        limit: 30,
        offset: nextOffset,
      });

      setConversations(previous => {
        const merged = new Map(
          previous.map(item => [String(item.id), item])
        );

        for (const item of data.conversations || []) {
          merged.set(String(item.id), item);
        }

        return Array.from(merged.values());
      });

      setHasMore(Boolean(data.hasMore));
      setNextOffset(data.nextOffset ?? 0);
    } catch (err) {
      setPaginationError(
        err.message || "Unable to load more conversations."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  // Synchronize conversation previews and read positions.
  function updateConversation(conversationId, changes) {
    setConversations(previous => {
      const updated = previous.map(item =>
        String(item.id) === String(conversationId)
          ? { ...item, ...changes }
          : item
      );

      return updated.sort((first, second) => {
        const difference =
          new Date(second.updated_at).getTime() -
          new Date(first.updated_at).getTime();

        if (difference) return difference;

        const firstId = BigInt(first.id);
        const secondId = BigInt(second.id);

        return firstId > secondId
          ? -1
          : firstId < secondId
            ? 1
            : 0;
      });
    });
  }

  const selectedConversation = conversations.find(
    item => String(item.id) === String(selectedId)
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3e7ef] bg-white">

      <div className="grid min-h-[520px] @min-[650px]/platform:grid-cols-[minmax(240px,36%)_minmax(0,1fr)]">

        {/* Conversation inbox */}
        <div className={`min-w-0 @min-[650px]/platform:block @min-[650px]/platform:border-r @min-[650px]/platform:border-[#e7eaf1] ${
          selectedConversation ? "hidden" : "block"
        }`}>
          <div className="h-[560px]">
            <ConversationInbox
              conversations={conversations}
              selectedId={selectedId}
              currentUserId={user.id}
              role={user.role}
              loading={loading}
              error={error}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onSelect={conversation => {
                setSelectionError("");
                setSelectedId(conversation.id);
              }}
              onRetry={retryInbox}
              onLoadMore={loadMoreConversations}
            />
          </div>

          {selectionError && (
            <p
              role="alert"
              className="border-t border-[#e7eaf1] p-3 text-xs text-red-700"
            >
              {selectionError}
            </p>
          )}

          {paginationError && (
            <p
              role="alert"
              className="border-t border-[#e7eaf1] p-3 text-xs text-[#68758c]"
            >
              {paginationError}
            </p>
          )}
        </div>

        {/* Selected conversation */}
        <div className={`min-w-0 @min-[650px]/platform:block ${
          selectedConversation ? "block" : "hidden"
        }`}>

          {selectedConversation ? (
            <ConnectedConversation
              key={String(selectedConversation.id)}
              conversation={selectedConversation}
              currentUserId={user.id}
              onBack={() => setSelectedId(null)}
              onConversationUpdate={updateConversation}
            />
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center p-6 text-center">

              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#edf1fa] text-[#26469b]">
                <Icon
                  name="message"
                  className="h-8 w-8"
                />
              </div>

              <h2 className="text-lg font-bold text-[#17233d]">
                Your messages
              </h2>

              <p className="mt-2 max-w-xs text-sm leading-6 text-[#68758c]">
                Select a conversation to connect with your tutors and students.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
