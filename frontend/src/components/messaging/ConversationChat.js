"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import {
  useRealtime,
  useRealtimeEvent,
} from "@/context/RealtimeContext";

import {
  MESSAGING_EVENTS,
} from "@/lib/realtimeClient";
import { Icon } from "@/components/Icons";
import { ProfileAvatar } from "@/components/UserAvatar";
import MessageReportAction from "./MessageReportAction";

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Compare PostgreSQL BIGINT message IDs without
// losing precision through JavaScript Number conversion.
function hasMessageBeenRead(messageId, readPosition) {
  if (messageId == null || readPosition == null) {
    return false;
  }

  try {
    const message = BigInt(messageId);
    const position = BigInt(readPosition);

    return message > 0n && position >= message;
  } catch {
    return false;
  }
}

function MessageBubble({
  message,
  conversationId,
  currentUserId,
  participantImageUrl,
  participantReadPosition,
}) {
  const own =
    String(message.sender_id) === String(currentUserId);

  const read =
    own &&
    hasMessageBeenRead(
      message.id,
      participantReadPosition
    );

  return (
    <div className={`flex items-end gap-2 ${
      own ? "justify-end" : "justify-start"
    }`}>

      {!own && (
        <ProfileAvatar
          imageUrl={participantImageUrl}
          size={28}
        />
      )}

      <div className={`min-w-0 rounded-2xl px-3.5 py-2.5 ${
        own ? "max-w-[82%]" : "max-w-[calc(100%-5.5rem)]"
      } ${
        own
          ? "rounded-br-sm bg-[#26469b] text-white"
          : "rounded-bl-sm border border-[#e3e7ef] bg-white text-[#17233d]"
      }`}>

        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6">
          {message.body}
        </p>

        <p className={`mt-1 text-right text-[10px] ${
          own ? "text-blue-100" : "text-[#68758c]"
        }`}>
          {formatTime(message.created_at)}

          {own && (
            <span
              className="ml-2 inline-flex items-center gap-1 font-medium"
            >
              <span aria-hidden="true">·</span>

              <span>
                {read ? "Read" : "Sent"}
              </span>

              <span aria-hidden="true">
                {read ? "✓✓" : "✓"}
              </span>
            </span>
          )}
        </p>
      </div>

      {!own && (
        <MessageReportAction
          key={`${currentUserId}:${conversationId}:${message.id}`}
          conversationId={conversationId}
          message={message}
        />
      )}
    </div>
  );
}

const TYPING_UPDATE_INTERVAL_MS = 1200;
const TYPING_IDLE_TIMEOUT_MS = 2000;

function useTypingActivity(conversationId, disabled) {
  const { connected, sendTyping } = useRealtime();

  const idleTimer = useRef(null);
  const typingActive = useRef(false);
  const lastUpdateAt = useRef(0);

  const id = String(conversationId);

  const stopTyping = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = null;

    if (typingActive.current) {
      sendTyping(id, false);
    }

    typingActive.current = false;
    lastUpdateAt.current = 0;
  }, [id, sendTyping]);

  const reportTyping = useCallback((value) => {
    if (
      disabled ||
      !connected ||
      !value.trim() ||
      document.visibilityState !== "visible"
    ) {
      stopTyping();
      return;
    }

    const now = Date.now();

    if (
      !typingActive.current ||
      now - lastUpdateAt.current >=
        TYPING_UPDATE_INTERVAL_MS
    ) {
      if (sendTyping(id, true)) {
        typingActive.current = true;
        lastUpdateAt.current = now;
      }
    }

    clearTimeout(idleTimer.current);

    idleTimer.current = setTimeout(
      stopTyping,
      TYPING_IDLE_TIMEOUT_MS
    );
  }, [
    disabled,
    connected,
    id,
    sendTyping,
    stopTyping,
  ]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") {
        stopTyping();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener("blur", stopTyping);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "blur",
        stopTyping
      );

      stopTyping();
    };
  }, [stopTyping, disabled, connected]);

  return {
    reportTyping,
    stopTyping,
  };
}

function ParticipantTypingStatus({
  conversationId,
  participantId,
  participantRole,
}) {
  const [isTyping, setIsTyping] = useState(false);

  const expiryTimer = useRef(null);

  const clearTyping = useCallback(() => {
    clearTimeout(expiryTimer.current);
    expiryTimer.current = null;

    setIsTyping(false);
  }, []);

  const handleTypingStatus = useCallback(
    payload => {
      if (
        !payload ||
        payload.conversationId !==
          String(conversationId) ||
        payload.userId !==
          String(participantId) ||
        typeof payload.isTyping !== "boolean"
      ) {
        return;
      }

      if (!payload.isTyping) {
        clearTyping();
        return;
      }

      if (
        !Number.isInteger(payload.expiresInMs) ||
        payload.expiresInMs <= 0 ||
        payload.expiresInMs > 3000
      ) {
        return;
      }

      clearTimeout(expiryTimer.current);


      setIsTyping(true);

      expiryTimer.current = setTimeout(
        clearTyping,
        payload.expiresInMs
      );
    },
    [
      conversationId,
      participantId,
      clearTyping,
    ]
  );

  useRealtimeEvent(
    MESSAGING_EVENTS.TYPING_STATUS,
    handleTypingStatus
  );

  useEffect(() => {
    return () => {
      clearTimeout(expiryTimer.current);
    };
  }, []);

  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-1 flex items-center gap-1.5 text-xs ${
        isTyping
          ? "font-medium text-[#26469b]"
          : "capitalize text-[#68758c]"
      }`}
    >
      {isTyping ? (
        <>
          <span
            aria-hidden="true"
            className="flex items-center gap-0.5"
          >
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="h-1 w-1 rounded-full bg-[#26469b] motion-safe:animate-bounce"
                style={{
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </span>

          <span>Typing...</span>
        </>
      ) : (
        participantRole
      )}
    </p>
  );
}

function MessageComposer({
  conversationId,
  disabled,
  sending,
  sendError,
  onSend,
}) {
  const [draft, setDraft] = useState("");

  const {
    reportTyping,
    stopTyping,
  } = useTypingActivity(
    conversationId,
    disabled || sending
  );

  function handleDraftChange(event) {
    const value = event.target.value;

    setDraft(value);
    reportTyping(value);
  }

  const characterCount = Array.from(draft).length;

  const canSend =
    !disabled &&
    !sending &&
    draft.trim().length > 0 &&
    characterCount <= 4000;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSend) return;

    stopTyping();

    const submitted = draft;

    try {
      const success = await onSend(submitted.trim());

      if (success) {
        setDraft(current =>
          current === submitted ? "" : current
        );
      }
    } catch {
      // The workspace handles request errors.
      // Preserve the draft for another attempt.
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-[#e7eaf1] bg-white p-3"
    >
      {sendError && (
        <p
          role="alert"
          className="mb-2 text-xs text-red-700"
        >
          {sendError}
        </p>
      )}

      <div className="flex items-end gap-2">

        <textarea
          value={draft}
          onChange={handleDraftChange}
          onBlur={stopTyping}
          disabled={disabled || sending}
          rows={2}
          maxLength={8000}
          aria-label="Write a message"
          placeholder="Write a message..."
          className="min-w-0 flex-1 resize-none rounded-xl border border-[#e3e7ef] bg-[#f7f9fd] px-3 py-2.5 text-sm leading-5 text-[#17233d] outline-none focus:border-[#26469b] disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label={sending ? "Sending message" : "Send message"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#26469b] text-white transition hover:bg-[#173472] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
              <path d="M22 2 11 13" />
            </svg>
          )}
        </button>
      </div>

      {characterCount > 3500 && (
        <p className={`mt-1 text-right text-xs ${
          characterCount > 4000
            ? "text-red-700"
            : "text-[#68758c]"
        }`}>
          {characterCount}/4000
        </p>
      )}
    </form>
  );
}

function ConversationActions({
  conversation,
  pending,
  onBlockChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const menuRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  const blockedByMe =
    conversation.blocked_by_me === true;

  useEffect(() => {
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  function openConfirmation() {
    setMenuOpen(false);
    setConfirmation(!blockedByMe);
    dialogRef.current?.showModal();
  }

  function closeConfirmation() {
    if (pending) return;

    dialogRef.current?.close();
    setConfirmation(null);
    triggerRef.current?.focus();
  }

  async function confirmOperation() {
    if (pending || confirmation === null) return;

    const success =
      await onBlockChange(confirmation);

    if (success) {
      dialogRef.current?.close();
      setConfirmation(null);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Conversation options"
        aria-expanded={menuOpen}
        disabled={pending}
        onClick={() => setMenuOpen(value => !value)}
        className="grid h-10 w-10 place-items-center rounded-xl text-[#26469b] hover:bg-[#edf1fa] disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-[#e3e7ef] bg-white p-1.5 shadow-lg">
          <button
            type="button"
            onClick={openConfirmation}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-[#f7f9fd] ${
              blockedByMe
                ? "text-[#26469b]"
                : "text-red-700"
            }`}
          >
            {blockedByMe
              ? "Unblock user"
              : "Block user"}
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="block-dialog-title"
        onCancel={event => {
          event.preventDefault();
          closeConfirmation();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#e3e7ef] bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        <h2
          id="block-dialog-title"
          className="text-lg font-bold text-[#17233d]"
        >
          {confirmation
            ? "Block this user?"
            : "Unblock this user?"}
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#68758c]">
          {confirmation
            ? "You will no longer be able to exchange new messages with this user. Your previous messages and existing bookings will remain unchanged."
            : "Messaging can resume if the other participant has not also blocked you."}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={closeConfirmation}
            className="btn-secondary"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={confirmOperation}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
              confirmation
                ? "bg-red-700 hover:bg-red-800"
                : "bg-[#26469b] hover:bg-[#173472]"
            }`}
          >
            {pending
              ? "Please wait..."
              : confirmation
                ? "Block user"
                : "Unblock user"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default function ConversationChat({
  conversation,
  messages = [],
  currentUserId,
  loading = false,
  error = "",
  hasMore = false,
  loadingMore = false,
  sending = false,
  sendError = "",
  historyError = "",
  blockPending = false,
  blockError = "",
  onBlockChange,
  onBack,
  onRetry,
  onLoadMore,
  onSend,
  historyRef,
}) {
  const { connected } = useRealtime();

  const restricted =
    conversation.is_blocked ||
    conversation.accounts_available === false;

  const tutorWaiting =
    conversation.participant_role === "student" &&
    !conversation.last_message_id &&
    messages.length === 0;

  const composerDisabled =
    blockPending ||
    restricted ||
    tutorWaiting ||
    loading ||
    Boolean(error);

  return (
    <section
      aria-label="Conversation"
      className="flex h-[560px] min-w-0 flex-col bg-white"
    >
      {/* Conversation header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e7eaf1] p-4">

        <button
          type="button"
          onClick={onBack}
          aria-label="Back to inbox"
          className="shrink-0 rounded-lg p-2 text-[#26469b] hover:bg-[#edf1fa] @min-[650px]/platform:hidden"
        >
          <span aria-hidden="true">←</span>
        </button>

        <ProfileAvatar
          imageUrl={conversation.participant_image_url}
          size={44}
        />

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-[#17233d]">
            {conversation.participant_name ||
              "TuLinkUp member"}
          </h2>

          {connected &&
          !blockPending &&
          !restricted &&
          !loading &&
          !error &&
          conversation.participant_id ? (
            <ParticipantTypingStatus
              key={`${conversation.id}:${conversation.participant_id}`}
              conversationId={conversation.id}
              participantId={conversation.participant_id}
              participantRole={conversation.participant_role}
            />
          ) : (
            <p className="mt-1 text-xs capitalize text-[#68758c]">
              {conversation.participant_role}
            </p>
          )}
        </div>

        {!loading && !error && onBlockChange && (
          <ConversationActions
            key={String(conversation.id)}
            conversation={conversation}
            pending={blockPending}
            onBlockChange={onBlockChange}
          />
        )}
      </div>

      {/* Message history */}
      <div
        ref={historyRef}
        aria-label="Message history"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f7f9fd] p-4"
      >

        {loading && (
          <div
            role="status"
            className="py-10 text-center text-sm text-[#68758c]"
          >
            Loading messages...
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="py-10 text-center">
            <p className="text-sm font-semibold text-[#17233d]">
              Unable to load messages
            </p>

            <p className="mt-2 text-xs text-[#68758c]">
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

        {!loading && !error && hasMore && (
          <div className="text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="rounded-lg px-3 py-2 text-xs font-bold text-[#26469b] hover:bg-[#edf1fa] disabled:opacity-50"
            >
              {loadingMore
                ? "Loading..."
                : "Load older messages"}
            </button>
          </div>
        )}

        {historyError && (
          <p role="alert" className="text-center text-xs text-red-700">
            {historyError}
          </p>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">

            <ProfileAvatar
              imageUrl={conversation.participant_image_url}
              size={64}
            />

            <h3 className="mt-4 font-bold text-[#17233d]">
              {conversation.participant_name ||
                "TuLinkUp member"}
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-5 text-[#68758c]">
              {restricted
                ? "Messaging is currently unavailable."
                : tutorWaiting
                  ? "Wait for the student to send their first message."
                  : "Start a conversation about your learning goals."}
            </p>
          </div>
        )}

        {!loading && !error && messages.map((message, index) => {
          const previous = messages[index - 1];

          const showDate =
            !previous ||
            new Date(previous.created_at).toDateString() !==
              new Date(message.created_at).toDateString();

          return (
            <div key={String(message.id)}>

              {showDate && (
                <div className="mb-4 text-center">
                  <span className="rounded-full bg-[#e9edf5] px-3 py-1 text-[10px] font-medium text-[#68758c]">
                    {formatDate(message.created_at)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                conversationId={conversation.id}
                currentUserId={currentUserId}
                participantImageUrl={
                  conversation.participant_image_url
                }
                participantReadPosition={
                  restricted
                    ? null
                    : conversation.participant_last_read_message_id
                }
              />
            </div>
          );
        })}
      </div>

      {/* Blocking operation feedback */}
      {blockError && (
        <p
          role="alert"
          className="shrink-0 border-t border-[#e7eaf1] px-4 py-3 text-center text-xs text-red-700"
        >
          {blockError}
        </p>
      )}

      {blockPending && (
        <p
          role="status"
          className="shrink-0 bg-[#f0f3f9] px-4 py-3 text-center text-xs text-[#68758c]"
        >
          Updating messaging preferences...
        </p>
      )}

      {/* Messaging restrictions */}
      {conversation.blocked_by_me === true ? (
        <div className="shrink-0 border-t border-[#e7eaf1] bg-[#f0f3f9] px-4 py-4 text-center">
          <p className="text-sm font-bold text-[#17233d]">
            You have blocked this user
          </p>

          <p className="mt-1 text-xs leading-5 text-[#68758c]">
            You cannot send or receive new messages from
            this user. Your previous conversation remains
            available.
          </p>

          <button
            type="button"
            disabled={blockPending}
            onClick={() => onBlockChange?.(false)}
            className="btn-secondary mt-3 text-xs"
          >
            {blockPending
              ? "Please wait..."
              : "Unblock user"}
          </button>
        </div>
      ) : (restricted || tutorWaiting) && (
        <div
          role="status"
          className="shrink-0 border-t border-[#e7eaf1] bg-[#f0f3f9] px-4 py-3 text-center text-xs text-[#68758c]"
        >
          {restricted
            ? "Messaging is currently unavailable."
            : "The student must send the first message."}
        </div>
      )}

      <MessageComposer
        key={String(conversation.id)}
        conversationId={String(conversation.id)}
        disabled={composerDisabled}
        sending={sending}
        sendError={sendError}
        onSend={onSend}
      />
    </section>
  );
}
