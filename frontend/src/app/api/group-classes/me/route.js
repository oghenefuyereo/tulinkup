
import { groupClassApi } from "@/lib/groupClassApi";

export const dynamic = "force-dynamic";

// Get group classes created by the current tutor.
export async function GET() {
  return groupClassApi("/me", {
    method: "GET",
    protectedRoute: true,
  });
}
