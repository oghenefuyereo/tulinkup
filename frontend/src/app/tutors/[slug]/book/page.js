
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/components/BookingForm";
import { MobileNav } from "@/components/MobileNav";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

export default async function BookingPage({ params }) {
  const { slug } = await params;

  const tutorResponse = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

  if (tutorResponse.status === 404) {
    notFound();
  }

  if (!tutorResponse.ok) {
    throw new Error(
      `Unable to load tutor profile (HTTP ${tutorResponse.status}).`
    );
  }

  const tutorData = await tutorResponse.json();
  const tutor = tutorData.tutor;

  if (!tutor) {
    notFound();
  }

  // Availability is associated with the tutor's user ID.
  const tutorId = tutor.user_id ?? tutor.userId;

  if (!tutorId) {
    throw new Error(
      "Tutor user ID is missing from the tutor API response."
    );
  }

  const availabilityResponse = await fetch(
    `${API_URL}/api/availability/tutor/${encodeURIComponent(tutorId)}`,
    {
      cache: "no-store",
    }
  );

  if (!availabilityResponse.ok) {
    const errorBody = await availabilityResponse.text();

    console.error("Tutor availability API error:", {
      status: availabilityResponse.status,
      response: errorBody,
    });

    throw new Error(
      `Unable to load tutor availability (HTTP ${availabilityResponse.status}).`
    );
  }

  const availabilityData = await availabilityResponse.json();

  const slots = Array.isArray(availabilityData.slots)
    ? availabilityData.slots
    : Array.isArray(availabilityData.availability)
      ? availabilityData.availability
      : [];

  const tutorName =
    tutor.name ??
    tutor.display_name ??
    tutor.displayName ??
    tutor.full_name ??
    "your tutor";

  return (
    <>
      <main className="min-h-screen bg-[#f7f9fd] py-8 sm:py-12">
        <div className="page-wrap">
          <Link
            href={`/tutors/${encodeURIComponent(slug)}`}
            className="text-sm font-bold text-[#52617b]"
          >
            ← Back to profile
          </Link>

          <p className="eyebrow mt-7">
            Book a session
          </p>

          <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">
            Choose a time with {tutorName}
          </h1>

          <p className="mt-3 text-[#68758c]">
            Select an available slot and tell your tutor
            what you want to achieve.
          </p>

          <div className="mt-8">
            <BookingForm
              tutor={tutor}
              slots={slots}
            />
          </div>
        </div>
      </main>

      <MobileNav />
    </>
  );
}
