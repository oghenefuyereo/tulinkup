
import {
  groupClassApi,
  isValidClassId,
  invalidClassId,
  invalidRequestBody,
} from "@/lib/groupClassApi";

export const dynamic = "force-dynamic";

// Get details of a published group class.
export async function GET(request, context) {
  const { id } = await context.params;

  if (!isValidClassId(id)) {
    return invalidClassId();
  }

  return groupClassApi(`/${id}`);
}

// Update a tutor's draft group class.
export async function PUT(request, context) {
  const { id } = await context.params;

  if (!isValidClassId(id)) {
    return invalidClassId();
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return invalidRequestBody();
  }

  return groupClassApi(`/${id}`, {
    method: "PUT",
    body,
    protectedRoute: true,
  });
}
