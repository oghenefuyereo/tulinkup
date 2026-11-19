// Import the classroom API utilities.
import {
  liveSessionApi,
  isValidSession,
  invalidSession,
} from "@/lib/liveSessionApi";

// Always retrieve the latest classroom status.
export const dynamic = "force-dynamic";

// Retrieve the current classroom status.
export async function GET(request, context) {
  const { type, id } = await context.params;

  if (!isValidSession(type, id)) {
    return invalidSession();
  }

  return liveSessionApi(`/${type}/${id}`);
}