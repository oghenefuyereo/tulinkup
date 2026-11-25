"use client";

// Display unread message counts consistently
// across the TuLinkUp navigation.
export default function UnreadMessageBadge({
  count = 0,
  variant = "inline",
  className = "",
}) {
  const unreadCount = Number(count);

  // Do not display invalid or empty counts.
  if (
    !Number.isSafeInteger(unreadCount) ||
    unreadCount <= 0
  ) {
    return null;
  }

  const displayCount =
    unreadCount > 99
      ? "99+"
      : String(unreadCount);

  const positionClass =
    variant === "overlay"
      ? "absolute -right-1 -top-1 border-2 border-white"
      : "shrink-0";

  return (
    <span
      aria-label={`${unreadCount} unread ${
        unreadCount === 1 ? "message" : "messages"
      }`}
      className={`pointer-events-none inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#26469b] px-1.5 text-[10px] font-bold leading-none text-white ${positionClass} ${className}`}
    >
      {displayCount}
    </span>
  );
}
