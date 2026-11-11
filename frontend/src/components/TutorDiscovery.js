
"use client";

import { useMemo, useState } from "react";
import { Icon } from "./Icons";
import { TutorCard } from "./TutorCard";

function normalizeTutor(tutor) {
  const rawSubjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : String(tutor.subject || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

  const subjects = rawSubjects
    .map((subject) =>
      typeof subject === "string"
        ? { id: subject, name: subject }
        : subject
    )
    .filter((subject) => subject?.name);

  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate
  );

  const rawRating = tutor.rating;

  const rating =
    rawRating == null || rawRating === ""
      ? null
      : Number(rawRating);

  return {
    ...tutor,
    name: tutor.name || tutor.full_name || "Tutor",
    title: tutor.title || "Tutor",
    subjects,
    hourlyRate: Number.isFinite(hourlyRate)
      ? hourlyRate
      : null,
    rating:
      rating !== null && Number.isFinite(rating)
        ? rating
        : null,
    reviewCount: Number(
      tutor.reviewCount ?? tutor.review_count ?? 0
    ),
    availabilityStatus:
      tutor.availabilityStatus || "appointment",
  };
}

export function TutorDiscovery({ tutors = [] }) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All subjects");
  const [price, setPrice] = useState("Any price");
  const [rating, setRating] = useState("Any rating");
  const [availability, setAvailability] = useState(
    "Any availability"
  );
  const [sort, setSort] = useState("Recommended");

  const normalizedTutors = useMemo(
    () =>
      (Array.isArray(tutors) ? tutors : []).map(
        normalizeTutor
      ),
    [tutors]
  );

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

  const hasRatings = normalizedTutors.some(
    (tutor) => tutor.rating !== null
  );

  const hasAvailableNow = normalizedTutors.some(
    (tutor) =>
      tutor.availabilityStatus === "available"
  );

  const results = useMemo(() => {
    const filtered = normalizedTutors.filter((tutor) => {
      const haystack = [
        tutor.name,
        tutor.title,
        tutor.subjects
          .map((subject) => subject.name)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(
        search.trim().toLowerCase()
      );

      const matchesSubject =
        subject === "All subjects" ||
        tutor.subjects.some(
          (item) => item.name === subject
        );

      const rate = tutor.hourlyRate;

      const matchesPrice =
        price === "Any price" ||
        (rate !== null &&
          (price === "Under $45"
            ? rate < 45
            : price === "$45–$55"
              ? rate >= 45 && rate <= 55
              : rate > 55));

      const matchesRating =
        rating === "Any rating" ||
        (tutor.rating !== null &&
          tutor.rating >= Number(rating));

      const matchesAvailability =
        availability === "Any availability" ||
        tutor.availabilityStatus === availability;

      return (
        matchesSearch &&
        matchesSubject &&
        matchesPrice &&
        matchesRating &&
        matchesAvailability
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "Price: low to high") {
        return (
          (a.hourlyRate ?? Infinity) -
          (b.hourlyRate ?? Infinity)
        );
      }

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

  function clearFilters() {
    setSearch("");
    setSubject("All subjects");
    setPrice("Any price");
    setRating("Any rating");
    setAvailability("Any availability");
    setSort("Recommended");
  }

  return (
    <div>
      <div className="panel p-4 sm:p-5">
        <label className="relative block">
          <Icon
            name="search"
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71809b]"
          />

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

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Filter
            value={subject}
            onChange={setSubject}
            options={[
              "All subjects",
              ...subjects,
            ]}
            ariaLabel="Filter by subject"
          />

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

      <div className="mt-8 flex items-center justify-between gap-4">
        <p
          className="text-sm font-semibold text-[#68758c]"
          aria-live="polite"
        >
          <span className="font-extrabold text-[#17233d]">
            {results.length}
          </span>{" "}
          tutors match your search
        </p>

        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-bold text-[#26469b]"
        >
          Clear filters
        </button>
      </div>

      {results.length > 0 ? (
        <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {results.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
            />
          ))}
        </div>
      ) : (
        <div className="panel mt-5 p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
            <Icon
              name="search"
              className="h-7 w-7"
            />
          </span>

          <h2 className="mt-5 text-xl font-bold text-[#17233d]">
            No tutors found
          </h2>

          <p className="mt-2 text-[#68758c]">
            Try broadening your subject, price, or
            availability filters.
          </p>
        </div>
      )}
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
  labels = {},
  ariaLabel,
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="form-input cursor-pointer bg-white"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option
          key={option}
          value={option}
        >
          {labels[option] ?? option}
        </option>
      ))}
    </select>
  );
}
