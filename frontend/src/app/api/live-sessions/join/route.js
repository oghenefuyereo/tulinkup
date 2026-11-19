// Import the classroom API utilities.
import {
  liveSessionApi,
  isValidSession,
  invalidSession,
} from "@/lib/liveSessionApi";

// Allow authorized participants to join a classroom.
export async function POST(request) {
  const body = await request
    .json()
    .catch(() => null);

  if (!isValidSession(body?.type, body?.id)) {
    return invalidSession();
  }

  return liveSessionApi("/join", {
    method: "POST",
    body: {
      type: body.type,
      id: String(body.id),
    },
  });
}