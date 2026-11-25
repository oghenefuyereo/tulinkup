"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { ProfileAvatar } from "@/components/UserAvatar";

function formatTimestamp(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}

function ConversationItem({
  conversation,
  selected,
  currentUserId,
  onSelect,
}) {
  const unreadCount =
    Number(conversation.unread_count) || 0;

  const hasUnread = unreadCount > 0;

  const isOwnMessage =
    conversation.last_message_sender_id != null &&
    String(conversation.last_message_sender_id) ===
      String(currentUserId);

  const preview = conversation.last_message
    ? `${isOwnMessage ? "You: " : ""}${conversation.last_message}`
    : "No messages yet";

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      aria-pressed={selected}
      className={`flex w-full min-w-0 items-center gap-3 border-b border-[#eef1f6] px-3 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#26469b] ${
        selected
          ? "bg-[#edf1fa]"
          : "hover:bg-[#f7f9fd]"
      }`}
    >
      <ProfileAvatar
        imageUrl={conversation.participant_image_url}
        size={48}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`min-w-0 flex-1 truncate text-sm text-[#17233d] ${
            hasUnread ? "font-extrabold" : "font-semibold"
          }`}>
            {conversation.participant_name || "TuLinkUp member"}
          </p>

          <span className="shrink-0 text-[10px] text-[#68758c]">
            {formatTimestamp(
              conversation.last_message_at ||
              conversation.created_at
            )}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <p className={`min-w-0 flex-1 truncate text-xs ${
            hasUnread
              ? "font-semibold text-[#17233d]"
              : "text-[#68758c]"
          }`}>
            {preview}
          </p>

          {hasUnread && (
            <span
              aria-label={`${unreadCount} unread messages`}
              className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#26469b] px-1.5 text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {conversation.is_blocked && (
          <p className="mt-1 text-[10px] text-[#68758c]">
            Messaging restricted
          </p>
        )}
      </div>
    </button>
  );
}

export default function ConversationInbox({
  conversations = [],
  selectedId = null,
  currentUserId,
  role,
  loading = false,
  error = "",
  hasMore = false,
  loadingMore = false,
  onSelect,
  onRetry,
  onLoadMore,
}) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  const filtered = conversations.filter(conversation => {
    if (!query) return true;

    return [
      conversation.participant_name,
      conversation.last_message,
    ].some(value =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  return (
    <section
      aria-label="Conversation inbox"
      className="flex h-full min-h-0 min-w-0 flex-col bg-white"
    >
      <div className="shrink-0 border-b border-[#e7eaf1] p-4">
        <h2 className="text-lg font-extrabold text-[#17233d]">
          Inbox
        </h2>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#e3e7ef] bg-[#f7f9fd] px-3 py-2.5 focus-within:border-[#26469b]">
          <Icon
            name="search"
            className="h-4 w-4 shrink-0 text-[#68758c]"
          />

          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search loaded conversations"
            maxLength={200}
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-[#17233d] !outline-none !ring-0 !shadow-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">

        {loading && (
          <div
            role="status"
            className="space-y-4 p-4"
          >
            <span className="sr-only">
              Loading conversations
            </span>

            {[1, 2, 3].map(item => (
              <div
                key={item}
                aria-hidden="true"
                className="flex animate-pulse items-center gap-3"
              >
                <div className="h-12 w-12 shrink-0 rounded-full bg-[#edf1fa]" />

                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-[#edf1fa]" />
                  <div className="h-3 w-full rounded bg-[#f0f3f9]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="p-5 text-center"
          >
            <p className="text-sm font-semibold text-[#17233d]">
              Unable to load conversations
            </p>

            <p className="mt-2 text-xs leading-5 text-[#68758c]">
              {error}
            </p>

            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary mt-4"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#edf1fa] text-[#26469b]">
              <Icon
                name="message"
                className="h-7 w-7"
              />
            </div>

            <h3 className="mt-4 text-sm font-bold text-[#17233d]">
              No conversations yet
            </h3>

            <p className="mt-2 text-xs leading-5 text-[#68758c]">
              {role === "student"
                ? "Find a tutor and start a conversation about your learning goals."
                : "Your conversations will appear here when students contact you."}
            </p>

            {role === "student" && (
              <Link
                href="/tutors"
                className="btn-primary mt-4"
              >
                Find a tutor
              </Link>
            )}
          </div>
        )}

        {!loading &&
          !error &&
          conversations.length > 0 &&
          filtered.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-[#17233d]">
                No matching conversations
              </p>

              <p className="mt-2 text-xs text-[#68758c]">
                Try a different search term.
              </p>

              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-3 text-xs font-bold text-[#26469b]"
              >
                Clear search
              </button>
            </div>
          )}

        {!loading && !error && filtered.map(conversation => (
          <ConversationItem
            key={String(conversation.id)}
            conversation={conversation}
            selected={
              selectedId != null &&
              String(selectedId) === String(conversation.id)
            }
            currentUserId={currentUserId}
            onSelect={onSelect}
          />
        ))}

        {!loading && !error && hasMore && (
          <div className="p-3 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {loadingMore
                ? "Loading..."
                : "Load more conversations"}
            </button>
          </div>
        )}

        {!loading && !error && query && hasMore && (
          <p className="px-4 pb-3 text-center text-xs text-[#68758c]">
            Search covers loaded conversations only.
          </p>
        )}
      </div>
    </section>
  );
}
