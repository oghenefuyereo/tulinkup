
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { BookingForm } from "@/components/BookingForm";
import { MobileNav } from "@/components/MobileNav";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

export default async function BookingPage({ params }) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

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
    throw new Error("Unable to load tutor profile.");
  }

  const tutorData = await tutorResponse.json();
  const tutor = tutorData.tutor;

  if (!tutor) {
    notFound();
  }

  const availabilityResponse = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}/availability`,
    {
      cache: "no-store",
    }
  );

  if (!availabilityResponse.ok) {
    throw new Error("Unable to load tutor availability.");
  }

  const availabilityData = await availabilityResponse.json();
  const slots = availabilityData.slots ?? [];

  return (
    <>
      <main className="min-h-screen bg-[#f7f9fd] py-8 sm:py-12">
        <div className="page-wrap">
          <Link
            href={`/tutors/${slug}`}
            className="text-sm font-bold text-[#52617b]"
          >
            ← Back to profile
          </Link>

          <p className="eyebrow mt-7">
            Book a session
          </p>

          <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">
            Choose a time with {tutor.name}
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
