
import {
  groupClassApi,
  isValidClassId,
  invalidClassId,
} from "@/lib/groupClassApi";

export const dynamic = "force-dynamic";

// Get students enrolled in the tutor's own class.
export async function GET(request, context) {
  const { id } = await context.params;

  if (!isValidClassId(id)) {
    return invalidClassId();
  }

  return groupClassApi(`/${id}/students`, {
    method: "GET",
    protectedRoute: true,
  });
}
