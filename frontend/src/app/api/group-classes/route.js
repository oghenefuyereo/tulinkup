
import {
  groupClassApi,
  invalidRequestBody,
} from "@/lib/groupClassApi";

export const dynamic = "force-dynamic";

// Get all published group classes.
export async function GET() {
  return groupClassApi();
}

// Create a new group class.
export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return invalidRequestBody();
  }

  return groupClassApi("", {
    method: "POST",
    body,
    protectedRoute: true,
  });
}
