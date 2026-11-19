
import {
  groupClassApi,
  isValidClassId,
  invalidClassId,
} from "@/lib/groupClassApi";

// Enrol the signed-in student in a group class.
export async function POST(request, context) {
  const { id } = await context.params;

  if (!isValidClassId(id)) {
    return invalidClassId();
  }

  return groupClassApi(`/${id}/enroll`, {
    method: "POST",
    protectedRoute: true,
  });
}
