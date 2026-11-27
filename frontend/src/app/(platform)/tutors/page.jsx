
// Enable client-side interactivity.
"use client";

// Import React hooks and Next.js navigation.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TutorCard } from "@/components/TutorCard";

// Create the tutor marketplace page.
export default function TutorsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="panel p-8 text-center">
          Loading tutors...
        </div>
      }
    >
      <TutorMarketplace />
    </Suspense>
  );
}

function TutorMarketplace() {
  // Store tutor information.
  const [tutors, setTutors] = useState([]);

  // Manage loading and error states.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Manage search and filter values.
  const params = useSearchParams();
  const [searchOverride, setSearch] = useState(null);

  // Read the initial search directly from URL parameters.
  const initialSearch = (
    params.get("q") || params.get("subject") || ""
  ).trim().slice(0, 200);

  const search = searchOverride ?? initialSearch;
  const [subject, setSubject] = useState("all");
  const [price, setPrice] = useState("all");
  const [rating, setRating] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("recommended");

  // Retrieve tutors from the TuLinkUp API.
  useEffect(() => {
    const controller = new AbortController();

    async function loadTutors() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/tutors", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load tutors.");
        }

        const data = await response.json();

        if (!Array.isArray(data.tutors)) {
          throw new Error("Invalid tutor data received.");
        }

        setTutors(data.tutors);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Load tutors error:", error);
          setError(
            "Unable to load tutors. Please try again."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTutors();

    return () => controller.abort();
  }, []);

  // Retrieve unique subjects from registered tutors.
  const subjects = useMemo(() => {
    return [
      ...new Set(
        tutors.flatMap((tutor) =>
          (tutor.subjects || []).map((item) => item.name)
        )
      ),
    ].sort();
  }, [tutors]);

  // Filter and sort the available tutors.
  const filteredTutors = useMemo(() => {
    let result = [...tutors];

    // Search by name, title, biography, or subject.
    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter((tutor) => {
        const searchableText = [
          tutor.name,
          tutor.title,
          tutor.biography,
          ...(tutor.subjects || []).map(
            (item) => item.name
          ),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Filter by subject.
    if (subject !== "all") {
      result = result.filter((tutor) =>
        (tutor.subjects || []).some(
          (item) =>
            item.name.toLowerCase() ===
            subject.toLowerCase()
        )
      );
    }

    // Filter by hourly rate.
    if (price === "under45") {
      result = result.filter(
        (tutor) => tutor.hourlyRate < 45
      );
    }

    if (price === "45to55") {
      result = result.filter(
        (tutor) =>
          tutor.hourlyRate >= 45 &&
          tutor.hourlyRate <= 55
      );
    }

    if (price === "over55") {
      result = result.filter(
        (tutor) => tutor.hourlyRate > 55
      );
    }

    // Filter by tutor rating.
    if (rating !== "all") {
      result = result.filter(
        (tutor) =>
          tutor.rating !== null &&
          tutor.rating !== undefined &&
          Number(tutor.rating) >= Number(rating)
      );
    }

    // Filter by availability status.
    if (availability !== "all") {
      result = result.filter(
        (tutor) =>
          tutor.availabilityStatus === availability
      );
    }

    // Sort by highest rating.
    if (sort === "rating") {
      result.sort(
        (a, b) =>
          Number(b.rating || 0) -
          Number(a.rating || 0)
      );
    }

    // Sort by lowest hourly rate.
    if (sort === "price-low") {
      result.sort(
        (a, b) => a.hourlyRate - b.hourlyRate
      );
    }

    // Sort by highest hourly rate.
    if (sort === "price-high") {
      result.sort(
        (a, b) => b.hourlyRate - a.hourlyRate
      );
    }

    return result;
  }, [
    tutors,
    search,
    subject,
    price,
    rating,
    availability,
    sort,
  ]);

  // Reset all marketplace filters.
  function clearFilters() {
    setSearch("");
    setSubject("all");
    setPrice("all");
    setRating("all");
    setAvailability("all");
    setSort("recommended");
  }

  // Reusable styling for filter inputs.
  const filterStyle =
    "w-full rounded-xl border border-[#dce2ec] bg-white px-4 py-3 text-sm text-[#17233d] outline-none focus:border-[#26469b] focus:ring-2 focus:ring-[#26469b]/10";

  return (
    <main className="min-w-0 bg-[#f7f9fd] py-2 text-[#17233d]">
      <div className="mx-auto max-w-7xl">

        {/* Marketplace heading */}
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-widest text-[#26469b]">
            Tutor Marketplace
          </p>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            Find someone who gets how you learn.
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-[#68758c]">
            Explore qualified tutors, compare expertise
            and availability, and book with confidence.
          </p>
        </div>

        {/* Search and filters */}
        <section className="mb-8 rounded-2xl border border-[#e5e9f0] bg-white p-5 shadow-sm">

          <input
            type="search"
            aria-label="Search tutors"
            placeholder="Search tutors by name, subject, or expertise..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className={filterStyle}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 @min-[420px]/platform:grid-cols-2 @min-[900px]/platform:grid-cols-5">

            {/* Subject filter */}
            <select
              aria-label="Filter by subject"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              className={filterStyle}
            >
              <option value="all">
                All subjects
              </option>

              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {/* Price filter */}
            <select
              aria-label="Filter by price"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              className={filterStyle}
            >
              <option value="all">Any price</option>
              <option value="under45">Under $45</option>
              <option value="45to55">$45–$55</option>
              <option value="over55">Over $55</option>
            </select>

            {/* Rating filter */}
            <select
              aria-label="Filter by rating"
              value={rating}
              onChange={(event) =>
                setRating(event.target.value)
              }
              className={filterStyle}
            >
              <option value="all">Any rating</option>
              <option value="4.5">4.5 and above</option>
              <option value="4.8">4.8 and above</option>
            </select>

            {/* Availability filter */}
            <select
              aria-label="Filter by availability"
              value={availability}
              onChange={(event) =>
                setAvailability(event.target.value)
              }
              className={filterStyle}
            >
              <option value="all">
                Any availability
              </option>
              <option value="available">
                Available now
              </option>
              <option value="appointment">
                By appointment
              </option>
            </select>

            {/* Sorting options */}
            <select
              aria-label="Sort tutors"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
              className={filterStyle}
            >
              <option value="recommended">
                Recommended
              </option>
              <option value="rating">
                Highest rating
              </option>
              <option value="price-low">
                Price: low to high
              </option>
              <option value="price-high">
                Price: high to low
              </option>
            </select>
          </div>
        </section>

        {/* Loading state */}
        {loading && (
          <div
            role="status"
            className="rounded-2xl bg-white p-12 text-center"
          >
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e5e9f0] border-t-[#26469b]" />

            <p className="mt-4 text-[#68758c]">
              Loading tutors...
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
          >
            <p className="font-semibold text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#26469b] px-6 py-3 font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Results count */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p
                aria-live="polite"
                className="font-semibold"
              >
                {filteredTutors.length}{" "}
                {filteredTutors.length === 1
                  ? "tutor matches"
                  : "tutors match"}{" "}
                your search
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-bold text-[#26469b] hover:underline"
              >
                Clear filters
              </button>
            </div>

            {/* Tutor cards */}
            {filteredTutors.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 @min-[560px]/platform:grid-cols-2 @min-[1000px]/platform:grid-cols-3">

                {filteredTutors.map((tutor) => (
                  <TutorCard
                    key={tutor.id}
                    tutor={tutor}
                    showQuickActions
                  />
                ))}
              </div>
            ) : (
              /* No matching tutors */
              <div className="rounded-2xl border border-[#e5e9f0] bg-white p-12 text-center">
                <h2 className="text-2xl font-bold">
                  No tutors found
                </h2>

                <p className="mt-3 text-[#68758c]">
                  Try changing your search or clearing
                  your filters to discover more tutors.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 rounded-xl bg-[#26469b] px-6 py-3 font-bold text-white"
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
