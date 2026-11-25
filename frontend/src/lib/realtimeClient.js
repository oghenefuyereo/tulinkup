import { io } from "socket.io-client";

// Shared event names matching the Express backend.
export const MESSAGING_EVENTS = Object.freeze({
  MESSAGE_CREATED: "messaging:message-created",
  CONVERSATION_UPDATED: "messaging:conversation-updated",
  MESSAGES_READ: "messaging:messages-read",
  UNREAD_UPDATED: "messaging:unread-updated",
  TYPING_STATUS: "messaging:typing-status",
});

const TYPING_UPDATE_EVENT = "messaging:typing-update";

const MAX_RECONNECT_ATTEMPTS = 8;
const MAX_RECONNECT_DELAY = 30000;
const CONNECTION_TIMEOUT = 15000;

function getRealtimeUrl() {
  const configured =
    process.env.NEXT_PUBLIC_REALTIME_URL;

  const value =
    configured ||
    (
      process.env.NODE_ENV === "development"
        ? "http://localhost:5001"
        : ""
    );

  if (!value) {
    throw new Error(
      "Real-time server is not configured."
    );
  }

  const url = new URL(value);

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !["http:", "https:"].includes(url.protocol)
  ) {
    throw new Error(
      "Invalid real-time server configuration."
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Secure real-time connection required."
    );
  }

  return url.origin;
}

class RealtimeError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "RealtimeError";
    this.status = status;
  }
}

// Retrieve a short-lived ticket without exposing
// the main authentication token to the browser.
async function requestTicket(signal) {
  const response = await fetch(
    "/api/realtime/ticket",
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
      },
    }
  );

  const data = await response.json().catch(
    () => null
  );

  if (
    !response.ok ||
    !data?.success ||
    typeof data.ticket !== "string" ||
    !data.ticket ||
    data.ticket.length > 4096
  ) {
    throw new RealtimeError(
      "Unable to authenticate real-time connection.",
      response.status
    );
  }

  return data.ticket;
}

export function createRealtimeClient({
  onStatus = () => {},
  onEvent = () => {},
} = {}) {
  const serverUrl = getRealtimeUrl();

  let socket = null;
  let ready = false;
  let stopped = false;
  let connecting = false;
  let retryTimer = null;
  let readyTimer = null;
  let ticketController = null;
  let attempts = 0;

  function updateStatus(status) {
    if (!stopped) {
      onStatus(status);
    }
  }

  function clearTimers() {
    clearTimeout(retryTimer);
    clearTimeout(readyTimer);

    retryTimer = null;
    readyTimer = null;
  }

  function disposeSocket() {
    ready = false;
    clearTimeout(readyTimer);
    readyTimer = null;

    if (socket) {
      const current = socket;

      socket = null;

      current.removeAllListeners();
      current.disconnect();
      current.auth = {};
    }
  }

  function scheduleReconnect() {
    if (
      stopped ||
      retryTimer ||
      connecting
    ) {
      return;
    }

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      updateStatus("unavailable");
      return;
    }

    const delay = Math.min(
      1000 * 2 ** attempts,
      MAX_RECONNECT_DELAY
    );

    attempts += 1;

    updateStatus("reconnecting");

    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay + Math.random() * 500);
  }

  async function connect() {
    if (
      stopped ||
      connecting ||
      socket
    ) {
      return;
    }

    connecting = true;

    updateStatus("connecting");

    const controller = new AbortController();

    ticketController = controller;

    const ticketTimer = setTimeout(
      () => controller.abort(),
      CONNECTION_TIMEOUT
    );

    let shouldRetry = false;

    try {
      const ticket = await requestTicket(
        controller.signal
      );

      if (stopped) {
        return;
      }

      const current = io(serverUrl, {
        path: "/socket.io",
        autoConnect: false,
        reconnection: false,
        forceNew: true,
        transports: ["websocket", "polling"],
        withCredentials: false,
        timeout: CONNECTION_TIMEOUT,
        auth: { ticket },
      });

      socket = current;

      function connectionFailed() {
        if (
          stopped ||
          socket !== current
        ) {
          return;
        }

        disposeSocket();
        scheduleReconnect();
      }

      current.on("realtime:ready", () => {
        if (
          stopped ||
          socket !== current
        ) {
          return;
        }

        clearTimeout(readyTimer);
        readyTimer = null;

        current.auth = {};

        ready = true;
        attempts = 0;

        updateStatus("connected");
      });

      current.on(
        "connect_error",
        connectionFailed
      );

      current.on(
        "disconnect",
        connectionFailed
      );

      for (
        const event of Object.values(
          MESSAGING_EVENTS
        )
      ) {
        current.on(event, payload => {
          if (
            !stopped &&
            socket === current
          ) {
            onEvent(event, payload);
          }
        });
      }

      readyTimer = setTimeout(
        connectionFailed,
        CONNECTION_TIMEOUT
      );

      current.connect();
    } catch (error) {
      disposeSocket();

      if (!stopped) {
        if (
          error.status === 401 ||
          error.status === 403
        ) {
          updateStatus("unauthorized");
        } else {
          shouldRetry = true;
        }
      }
    } finally {
      clearTimeout(ticketTimer);

      if (ticketController === controller) {
        ticketController = null;
      }

      connecting = false;

      if (shouldRetry) {
        scheduleReconnect();
      }
    }
  }

  // Typing activity is temporary and must never
  // be queued while the connection is unavailable.
  function sendTyping(conversationId, isTyping) {
    if (
      stopped ||
      !ready ||
      !socket?.connected ||
      typeof conversationId !== "string" ||
      !/^[1-9][0-9]{0,18}$/.test(conversationId) ||
      BigInt(conversationId) > 9223372036854775807n ||
      typeof isTyping !== "boolean"
    ) {
      return false;
    }


    socket.emit(
      TYPING_UPDATE_EVENT,
      {
        conversationId,
        isTyping,
      }
    );

    return true;
  }

  function stop() {
    stopped = true;

    clearTimers();

    ticketController?.abort();
    ticketController = null;

    disposeSocket();
  }

  return {
    connect,
    stop,
    sendTyping,
  };
}
