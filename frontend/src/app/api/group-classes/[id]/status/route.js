
import {
  groupClassApi,
  isValidClassId,
  invalidClassId,
  invalidRequestBody,
} from "@/lib/groupClassApi";

// Publish or cancel a group class.
export async function PATCH(request, context) {
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

  return groupClassApi(`/${id}/status`, {
    method: "PATCH",
    body,
    protectedRoute: true,
  });
}
