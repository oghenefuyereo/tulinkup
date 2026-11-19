
// Import shared group class API utilities.
import {
  groupClassApi,
  isValidClassId,
  invalidClassId,
} from "@/lib/groupClassApi";

// Handle student group class enrolment cancellation.
export async function PATCH(request, context) {
  // Get the group class ID from the route parameters.
  const { id } = await context.params;

  // Validate the group class ID.
  if (!isValidClassId(id)) {
    return invalidClassId();
  }

  // Forward the authenticated cancellation request
  // to the Express backend.
  return groupClassApi(`/${id}/cancel-enrollment`, {
    method: "PATCH",
    protectedRoute: true,
  });
}
