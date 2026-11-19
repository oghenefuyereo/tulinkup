// Import the classroom component.
import LiveClassroom from "@/components/LiveClassroom";

// Import Next.js navigation utilities.
import { notFound, redirect } from "next/navigation";

// Import cookies for server-side authentication.
import { cookies } from "next/headers";

// Configure the backend API URL.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Create the live classroom page.
export default async function ClassroomPage({ params }) {
  const { type, id } = await params;

  // Validate the classroom type and ID.
  if (
    !["one_on_one", "group"].includes(type) ||
    !/^[1-9]\d*$/.test(String(id))
  ) {
    notFound();
  }

  // Read the user's authentication cookie.
  const cookieStore = await cookies();

  // Get the stored authentication token.
  const token = cookieStore.get("tulinkup_token")?.value;

  // Prevent unauthenticated users from accessing classrooms.
  if (!token) {
    redirect("/login");
  }

  // Verify the user's identity with the Express backend.
  const response = await fetch(
    `${API_URL}/api/auth/me`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  // Redirect users with invalid or expired authentication.
  if (response.status === 401) {
    redirect("/login");
  }

  // Handle backend authentication service errors.
  if (!response.ok) {
    throw new Error(
      "Unable to verify classroom authentication."
    );
  }

  // Read the authenticated user's information.
  const data = await response.json();
  const user = data.user;

  // Ensure the authenticated user exists.
  if (!user) {
    redirect("/login");
  }

  // Only students and tutors can access classrooms.
  if (!["student", "tutor"].includes(user.role)) {
    notFound();
  }

  // Verify access to the specific classroom.
  const classroomResponse = await fetch(
    `${API_URL}/api/live-sessions/${type}/${id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  // Handle expired authentication.
  if (classroomResponse.status === 401) {
    redirect("/login");
  }

  // Prevent unauthorized classroom access.
  if ([403, 404].includes(classroomResponse.status)) {
    notFound();
  }

  // Handle unexpected classroom service errors.
  if (!classroomResponse.ok) {
    throw new Error(
      "Unable to verify classroom access."
    );
  }

  // Read the classroom information.
  const classroom = await classroomResponse.json();

  // Ensure classroom verification was successful.
  if (!classroom.success) {
    notFound();
  }

  // Display the authorized live classroom.
  return (
    <LiveClassroom
      key={`${type}:${id}`}
      type={type}
      sessionId={id}
      user={{
        id: user.id,
        fullName: user.full_name,
        role: user.role,
      }}
      initialClassroom={classroom}
    />
  );
}