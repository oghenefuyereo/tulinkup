
import { groupClassApi } from "@/lib/groupClassApi";

export const dynamic = "force-dynamic";

// Get classes that the current student has enrolled in.
export async function GET() {
  return groupClassApi("/my-enrollments", {
    method: "GET",
    protectedRoute: true,
  });
}
