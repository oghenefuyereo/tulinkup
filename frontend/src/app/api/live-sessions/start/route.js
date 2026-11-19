// Import the classroom API utilities.
import {
  liveSessionApi,
  isValidSession,
  invalidSession,
} from "@/lib/liveSessionApi";

// Allow the tutor to start a classroom.
export async function POST(request) {
  const body = await request
    .json()
    .catch(() => null);

  if (!isValidSession(body?.type, body?.id)) {
    return invalidSession();
  }

  return liveSessionApi("/start", {
    method: "POST",
    body: {
      type: body.type,
      id: String(body.id),
    },
  });
}