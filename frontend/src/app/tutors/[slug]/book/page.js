
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import notFound to display a 404 page when a tutor does not exist.
import { notFound } from "next/navigation";

// Import the booking form and mobile navigation components.
import { BookingForm } from "@/components/BookingForm";
import { MobileNav } from "@/components/MobileNav";

// Make sure the page loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for tutor and availability requests.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Create the page where students can book a session with a tutor.
export default async function BookingPage({ params }) {
  // Get the tutor's unique slug from the page URL.
  const { slug } = await params;

  // Request the selected tutor's profile from the Express backend.
  const tutorResponse = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

  // Display a 404 page if the tutor cannot be found.
  if (tutorResponse.status === 404) {
    notFound();
  }

  // Stop loading if the backend cannot retrieve the tutor's profile.
  if (!tutorResponse.ok) {
    throw new Error(
      `Unable to load tutor profile (HTTP ${tutorResponse.status}).`
    );
  }

  // Read the tutor information returned by the backend.
  const tutorData = await tutorResponse.json();
  const tutor = tutorData.tutor;

  // Display a 404 page if no tutor information is available.
  if (!tutor) {
    notFound();
  }

  // Availability is associated with the tutor's user ID.
  // Get the tutor's user ID to retrieve their available teaching times.
  const tutorId = tutor.user_id ?? tutor.userId;

  // Stop loading if the tutor's user ID is missing.
  if (!tutorId) {
    throw new Error(
      "Tutor user ID is missing from the tutor API response."
    );
  }

  // Request the tutor's available time slots from the backend.
  const availabilityResponse = await fetch(
    `${API_URL}/api/availability/tutor/${encodeURIComponent(tutorId)}`,
    {
      cache: "no-store",
    }
  );

  // Handle errors if the tutor's availability cannot be retrieved.
  if (!availabilityResponse.ok) {
    // Read the error information returned by the backend.
    const errorBody = await availabilityResponse.text();

    // Log the error details to help with troubleshooting.
    console.error("Tutor availability API error:", {
      status: availabilityResponse.status,
      response: errorBody,
    });

    // Stop loading if the availability request fails.
    throw new Error(
      `Unable to load tutor availability (HTTP ${availabilityResponse.status}).`
    );
  }

  // Read the tutor's availability information.
  const availabilityData = await availabilityResponse.json();

  // Get the available slots or use an empty list if none are returned.
  const slots = Array.isArray(availabilityData.slots)
    ? availabilityData.slots
    : Array.isArray(availabilityData.availability)
      ? availabilityData.availability
      : [];

  // Get the tutor's name from the available profile fields.
  const tutorName =
    tutor.name ??
    tutor.display_name ??
    tutor.displayName ??
    tutor.full_name ??
    "your tutor";

  // Display the booking page with the tutor's available sessions.
  return (
    <>
      {/* Main container for the tutor booking page. */}
      <main className="min-h-screen bg-[#f7f9fd] py-8 sm:py-12">
        <div className="page-wrap">
          {/* Provide a link back to the selected tutor's profile. */}
          <Link
            href={`/tutors/${encodeURIComponent(slug)}`}
            className="text-sm font-bold text-[#52617b]"
          >
            ← Back to profile
          </Link>

          {/* Display the booking page heading. */}
          <p className="eyebrow mt-7">
            Book a session
          </p>

          {/* Show the selected tutor's name in the page heading. */}
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">
            Choose a time with {tutorName}
          </h1>

          {/* Explain how students can request a tutoring session. */}
          <p className="mt-3 text-[#68758c]">
            Select an available slot and tell your tutor
            what you want to achieve.
          </p>

          {/* Display the booking form with the tutor's available slots. */}
          <div className="mt-8">
            <BookingForm
              tutor={tutor}
              slots={slots}
            />
          </div>
        </div>
      </main>

      {/* Display the mobile navigation menu. */}
      <MobileNav />
    </>
  );
}
