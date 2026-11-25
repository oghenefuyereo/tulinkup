"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";
import { createConversation } from "@/lib/messagingApi";

export default function MessageTutorButton({
  tutorUserId,
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const startingRef = useRef(false);

  async function handleMessage() {
    if (loading || startingRef.current) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role !== "student") return;

    startingRef.current = true;
    setStarting(true);
    setError("");

    try {
      const result = await createConversation(
        tutorUserId
      );

      const conversationId = String(
        result.conversation?.id ?? ""
      );

      if (
        !/^[1-9]\d{0,18}$/.test(conversationId) ||
        BigInt(conversationId) > 9223372036854775807n
      ) {
        throw new Error(
          "Unable to open this conversation."
        );
      }

      router.push(
        `/messages?conversation=${encodeURIComponent(conversationId)}`
      );
    } catch (err) {
      setError(
        err.message || "Unable to start a conversation."
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  // Only students can initiate private conversations.
  if (user && user.role !== "student") {
    return null;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleMessage}
        disabled={loading || starting}
        className="btn-secondary flex w-full gap-2 py-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon
          name="message"
          className="h-5 w-5"
        />

        {starting ? "Opening conversation..." : "Message"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 text-center text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
