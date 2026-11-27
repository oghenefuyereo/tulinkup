import { redirect } from "next/navigation";

// Keep existing availability links and bookmarks working.
export default function AvailabilityPage() {
  redirect("/dashboard/tutor/availability");
}
