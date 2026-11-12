
// Enable client-side interactions in this component.
"use client";

// Import React hooks to manage filters and search results.
import { useMemo, useState } from "react";

// Import the reusable icon component.
import { Icon } from "./Icons";

// Import TutorCard to display each tutor's information.
import { TutorCard } from "./TutorCard";

// Prepare tutor information in a consistent format.
function normalizeTutor(tutor) {
  // Get the subjects associated with the tutor.
  const rawSubjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : String(tutor.subject || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

  // Convert subjects into objects with an ID and name.
  const subjects = rawSubjects
    .map((subject) =>
      typeof subject === "string"
        ? { id: subject, name: subject }
        : subject
    )
    // Remove subjects that do not have a name.
    .filter((subject) => subject?.name);

  // Convert the tutor's hourly rate into a number.
  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate
  );

  // Get the tutor's original rating value.
  const rawRating = tutor.rating;

  // Convert the rating into a number if one exists.
  const rating =
    rawRating == null || rawRating === ""
      ? null
      : Number(rawRating);

  // Return the tutor's information in a consistent format.
  return {
    ...tutor,

    // Use default values when the tutor's name or title is missing.
    name: tutor.name || tutor.full_name || "Tutor",
    title: tutor.title || "Tutor",

    // Store the prepared list of subjects.
    subjects,

    // Keep valid hourly rates or use null when invalid.
    hourlyRate: Number.isFinite(hourlyRate)
      ? hourlyRate
      : null,

    // Keep valid ratings or use null when unavailable.
    rating:
      rating !== null && Number.isFinite(rating)
        ? rating
        : null,

    // Get the number of reviews received by the tutor.
    reviewCount: Number(
      tutor.reviewCount ?? tutor.review_count ?? 0
    ),

    // Use appointment-based availability as the default.
    availabilityStatus:
      tutor.availabilityStatus || "appointment",
  };
}

// Create the tutor discovery page with search and filtering options.
export function TutorDiscovery({ tutors = [] }) {
  // Store the student's search text.
  const [search, setSearch] = useState("");

  // Store the selected subject filter.
  const [subject, setSubject] = useState("All subjects");

  // Store the selected price filter.
  const [price, setPrice] = useState("Any price");

  // Store the selected rating filter.
  const [rating, setRating] = useState("Any rating");

  // Store the selected availability filter.
  const [availability, setAvailability] = useState(
    "Any availability"
  );

  // Store the selected sorting option.
  const [sort, setSort] = useState("Recommended");

  // Prepare the tutor data whenever the tutor list changes.
  const normalizedTutors = useMemo(
    () =>
      (Array.isArray(tutors) ? tutors : []).map(
        normalizeTutor
      ),
    [tutors]
  );

  // Create a unique list of subjects offered by all tutors.
  const subjects = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedTutors.flatMap((tutor) =>
            tutor.subjects.map((subject) => subject.name)
          )
        )
      ).sort(),
    [normalizedTutors]
  );

  // Check whether any tutors have ratings.
  const hasRatings = normalizedTutors.some(
    (tutor) => tutor.rating !== null
  );

  // Check whether any tutors are marked as available now.
  const hasAvailableNow = normalizedTutors.some(
    (tutor) =>
      tutor.availabilityStatus === "available"
  );

  // Filter and sort tutors based on the selected options.
  const results = useMemo(() => {
    // Find tutors who match all active filters.
    const filtered = normalizedTutors.filter((tutor) => {
      // Combine searchable tutor information into one string.
      const haystack = [
        tutor.name,
        tutor.title,
        tutor.subjects
          .map((subject) => subject.name)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();

      // Check whether the tutor matches the search text.
      const matchesSearch = haystack.includes(
        search.trim().toLowerCase()
      );

      // Check whether the tutor teaches the selected subject.
      const matchesSubject =
        subject === "All subjects" ||
        tutor.subjects.some(
          (item) => item.name === subject
        );

      // Get the tutor's hourly rate for price filtering.
      const rate = tutor.hourlyRate;

      // Check whether the tutor's rate matches the selected price range.
      const matchesPrice =
        price === "Any price" ||
        (rate !== null &&
          (price === "Under $45"
            ? rate < 45
            : price === "$45–$55"
              ? rate >= 45 && rate <= 55
              : rate > 55));

      // Check whether the tutor meets the selected minimum rating.
      const matchesRating =
        rating === "Any rating" ||
        (tutor.rating !== null &&
          tutor.rating >= Number(rating));

      // Check whether the tutor matches the availability filter.
      const matchesAvailability =
        availability === "Any availability" ||
        tutor.availabilityStatus === availability;

      // Include only tutors who match every selected filter.
      return (
        matchesSearch &&
        matchesSubject &&
        matchesPrice &&
        matchesRating &&
        matchesAvailability
      );
    });

    // Sort the filtered tutors based on the selected sorting option.
    return [...filtered].sort((a, b) => {
      // Sort tutors from the lowest hourly rate to the highest.
      if (sort === "Price: low to high") {
        return (
          (a.hourlyRate ?? Infinity) -
          (b.hourlyRate ?? Infinity)
        );
      }

      // Sort tutors from the highest rating to the lowest.
      if (sort === "Rating") {
        return (
          (b.rating ?? -1) -
          (a.rating ?? -1)
        );
      }

      // Until a recommendation ranking system exists,
      // keep the order returned by the backend.
      return 0;
    });
  }, [
    normalizedTutors,
    search,
    subject,
    price,
    rating,
    availability,
    sort,
  ]);

  // Reset all search and filtering options to their defaults.
  function clearFilters() {
    setSearch("");
    setSubject("All subjects");
    setPrice("Any price");
    setRating("Any rating");
    setAvailability("Any availability");
    setSort("Recommended");
  }

  // Display the tutor search interface and matching results.
  return (
    <div>
      {/* Display the search bar and filtering controls. */}
      <div className="panel p-4 sm:p-5">
        {/* Create the search input for finding tutors. */}
        <label className="relative block">
          {/* Display a search icon inside the input field. */}
          <Icon
            name="search"
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71809b]"
          />

          {/* Allow students to search by name, subject, or expertise. */}
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="form-input h-14 pl-12 text-base"
            placeholder="Search by tutor, subject or expertise"
            aria-label="Search tutors"
          />
        </label>

        {/* Display the subject, price, rating, availability, and sorting filters. */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {/* Filter tutors by the subjects they teach. */}
          <Filter
            value={subject}
            onChange={setSubject}
            options={[
              "All subjects",
              ...subjects,
            ]}
            ariaLabel="Filter by subject"
          />

          {/* Filter tutors by their hourly teaching rate. */}
          <Filter
            value={price}
            onChange={setPrice}
            options={[
              "Any price",
              "Under $45",
              "$45–$55",
              "Over $55",
            ]}
            ariaLabel="Filter by hourly price"
          />

          {/* Filter tutors by their minimum rating. */}
          <Filter
            value={rating}
            onChange={setRating}
            options={
              hasRatings
                ? ["Any rating", "4.5", "4.8"]
                : ["Any rating"]
            }
            ariaLabel="Filter by rating"
          />

          {/* Filter tutors by their availability status. */}
          <Filter
            value={availability}
            onChange={setAvailability}
            options={[
              "Any availability",
              ...(hasAvailableNow
                ? ["available"]
                : []),
              "appointment",
            ]}
            labels={{
              available: "Available now",
              appointment: "By appointment",
            }}
            ariaLabel="Filter by availability"
          />

          {/* Allow students to choose how tutors are sorted. */}
          <Filter
            value={sort}
            onChange={setSort}
            options={[
              "Recommended",
              ...(hasRatings ? ["Rating"] : []),
              "Price: low to high",
            ]}
            ariaLabel="Sort tutors"
          />
        </div>
      </div>

      {/* Display the number of matching tutors and reset option. */}
      <div className="mt-8 flex items-center justify-between gap-4">
        {/* Show how many tutors match the selected filters. */}
        <p
          className="text-sm font-semibold text-[#68758c]"
          aria-live="polite"
        >
          <span className="font-extrabold text-[#17233d]">
            {results.length}
          </span>{" "}
          tutors match your search
        </p>

        {/* Allow students to clear all active filters. */}
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-bold text-[#26469b]"
        >
          Clear filters
        </button>
      </div>

      {/* Display matching tutors or a message when none are found. */}
      {results.length > 0 ? (
        // Display tutor cards in a responsive grid.
        <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {results.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
            />
          ))}
        </div>
      ) : (
        // Display a message when no tutors match the filters.
        <div className="panel mt-5 p-12 text-center">
          {/* Display a search icon. */}
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
            <Icon
              name="search"
              className="h-7 w-7"
            />
          </span>

          {/* Display the no-results heading. */}
          <h2 className="mt-5 text-xl font-bold text-[#17233d]">
            No tutors found
          </h2>

          {/* Suggest adjusting the filters to find more tutors. */}
          <p className="mt-2 text-[#68758c]">
            Try broadening your subject, price, or
            availability filters.
          </p>
        </div>
      )}
    </div>
  );
}

// Create a reusable dropdown for filtering and sorting tutors.
function Filter({
  value,
  onChange,
  options,
  labels = {},
  ariaLabel,
}) {
  return (
    <select
      // Store the currently selected filter value.
      value={value}

      // Update the filter when the user selects another option.
      onChange={(event) =>
        onChange(event.target.value)
      }

      // Apply the standard styling for dropdown inputs.
      className="form-input cursor-pointer bg-white"

      // Provide an accessible label for the dropdown.
      aria-label={ariaLabel}
    >
      {/* Display all available options in the dropdown. */}
      {options.map((option) => (
        <option
          key={option}
          value={option}
        >
          {/* Use a custom label when available. */}
          {labels[option] ?? option}
        </option>
      ))}
    </select>
  );
}
