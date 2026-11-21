"use client";

import { useEffect, useState } from "react";
import GroupClassCard from "./GroupClassCard";

const MAX_GROUP_PRICE_CENTS = 1000;
const MAX_GROUP_STUDENTS = 20;
const MIN_GROUP_CAPACITY = 2;
const MAX_GROUP_REVENUE_CENTS = 10000;

// Check whether a class follows the platform pricing rules.
function hasValidClassPricing(groupClass) {
  if (
    !groupClass ||
    groupClass.price_cents == null
  ) {
    return false;
  }

  const priceCents = Number(groupClass.price_cents);
  const capacity = Number(groupClass.maximum_students);
  const minimumStudents = Number(
    groupClass.minimum_students
  );

  return (
    Number.isInteger(priceCents) &&
    priceCents >= 0 &&
    priceCents <= MAX_GROUP_PRICE_CENTS &&
    Number.isInteger(capacity) &&
    capacity >= MIN_GROUP_CAPACITY &&
    capacity <= MAX_GROUP_STUDENTS &&
    Number.isInteger(minimumStudents) &&
    minimumStudents >= 1 &&
    minimumStudents <= capacity &&
    priceCents * capacity <= MAX_GROUP_REVENUE_CENTS &&
    groupClass.currency === "CAD"
  );
}

// Calculate the number of available seats.
function getAvailableSeats(groupClass) {
  const capacity = Number(
    groupClass.maximum_students || 0
  );

  const enrolled = Number(
    groupClass.enrolled_students || 0
  );

  return Math.max(0, capacity - enrolled);
}

export default function GroupClassDiscovery() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("upcoming");
  const [availableOnly, setAvailableOnly] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm outline-none focus:border-[#26469b]";

  // Load published group classes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadClasses() {
      try {
        const response = await fetch(
          "/api/group-classes",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load classes."
          );
        }

        if (!controller.signal.aborted) {
          const receivedClasses = Array.isArray(data.classes)
            ? data.classes
            : [];

          // Only display classes with valid pricing.
          const validClasses = receivedClasses.filter(
            hasValidClassPricing
          );

          setClasses(validClasses);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadClasses();

    return () => controller.abort();
  }, []);

  // Retrieve the available subjects.
  const subjects = [
    ...new Set(
      classes.map((item) => item.subject).filter(Boolean)
    ),
  ].sort();

  // Retrieve the available education levels.
  const levels = [
    ...new Set(
      classes
        .map((item) => item.education_level)
        .filter(Boolean)
    ),
  ].sort();

  // Filter and sort the available classes.
  const filteredClasses = classes
    .filter((item) => {
      const searchText = [
        item.title,
        item.description,
        item.subject,
        item.education_level,
        item.tutor_name,
      ]
        .join(" ")
        .toLowerCase();

      const priceCents = Number(item.price_cents);

      const matchesSearch = searchText.includes(
        search.trim().toLowerCase()
      );

      const matchesSubject =
        subject === "all" || item.subject === subject;

      const matchesLevel =
        level === "all" ||
        item.education_level === level;

      const matchesPrice =
        price === "all" ||
        (price === "free" &&
          priceCents === 0) ||
        (price === "paid" &&
          priceCents > 0) ||
        (price === "under-five" &&
          priceCents > 0 &&
          priceCents <= 500) ||
        (price === "five-to-ten" &&
          priceCents > 500 &&
          priceCents <= 1000);

      const matchesAvailability =
        !availableOnly ||
        getAvailableSeats(item) > 0;

      return (
        matchesSearch &&
        matchesSubject &&
        matchesLevel &&
        matchesPrice &&
        matchesAvailability
      );
    })
    .sort((a, b) => {
      if (sort === "price-low") {
        return (
          Number(a.price_cents) -
          Number(b.price_cents)
        );
      }

      if (sort === "price-high") {
        return (
          Number(b.price_cents) -
          Number(a.price_cents)
        );
      }

      if (sort === "popular") {
        return (
          Number(b.enrolled_students || 0) -
          Number(a.enrolled_students || 0)
        );
      }

      if (sort === "available-seats") {
        return (
          getAvailableSeats(b) -
          getAvailableSeats(a)
        );
      }

      return (
        new Date(a.scheduled_at) -
        new Date(b.scheduled_at)
      );
    });

  // Reset all search filters.
  function clearFilters() {
    setSearch("");
    setSubject("all");
    setLevel("all");
    setPrice("all");
    setSort("upcoming");
    setAvailableOnly(false);
  }

  return (
    <div className="space-y-8">
      {/* Search section */}
      <div className="panel space-y-5 p-6">
        <label className="block space-y-2">
          <span className="text-sm font-bold">
            Find a group class
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search mathematics, science, programming..."
            className={inputClass}
          />
        </label>

        {/* Filters */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-bold">
              Subject
            </span>

            <select
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              className={inputClass}
            >
              <option value="all">All subjects</option>

              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold">
              Education level
            </span>

            <select
              value={level}
              onChange={(event) =>
                setLevel(event.target.value)
              }
              className={inputClass}
            >
              <option value="all">All levels</option>

              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold">
              Price per student
            </span>

            <select
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              className={inputClass}
            >
              <option value="all">All prices</option>

              <option value="free">
                Free classes
              </option>

              <option value="paid">
                All paid classes
              </option>

              <option value="under-five">
                $0.01 - $5 CAD
              </option>

              <option value="five-to-ten">
                $5.01 - $10 CAD
              </option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold">
              Sort by
            </span>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
              className={inputClass}
            >
              <option value="upcoming">
                Upcoming classes
              </option>

              <option value="price-low">
                Lowest price
              </option>

              <option value="price-high">
                Highest price
              </option>

              <option value="popular">
                Most enrolled
              </option>

              <option value="available-seats">
                Most available seats
              </option>
            </select>
          </label>
        </div>

        {/* Availability filter */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#17233d]">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) =>
                setAvailableOnly(event.target.checked)
              }
              className="h-4 w-4 accent-[#26469b]"
            />

            Show only classes with available seats
          </label>

          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-bold text-[#26469b]"
          >
            Clear all filters
          </button>
        </div>
      </div>

      {/* Group class pricing information */}
      <div className="rounded-xl border border-[#dce3ee] bg-[#f0f4ff] p-5">
        <h3 className="text-sm font-extrabold text-[#173472]">
          Affordable Group Learning
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#64748b]">
          Explore free and affordable live group classes
          for up to $10 CAD per student, per session.
          Each class accommodates up to 20 students,
          depending on the tutor&apos;s pricing and
          selected class capacity.
        </p>

        <p className="mt-2 text-xs font-semibold text-[#26469b]">
          Free enrolment is available. Paid enrolment
          is coming soon.
        </p>
      </div>

      {/* Class results */}
      {loading ? (
        <div className="panel p-12 text-center">
          Loading group classes...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"
        >
          {error}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              Explore group classes
            </h2>

            <p
              aria-live="polite"
              className="text-sm text-[#64748b]"
            >
              {filteredClasses.length}{" "}
              {filteredClasses.length === 1
                ? "class found"
                : "classes found"}
            </p>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="panel space-y-3 p-12 text-center">
              <h3 className="text-xl font-extrabold">
                No classes found
              </h3>

              <p className="text-sm text-[#64748b]">
                {classes.length === 0
                  ? "New group classes will appear here when tutors publish them."
                  : "Try changing your search or filters."}
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="font-bold text-[#26469b]"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClasses.map((item) => (
                <GroupClassCard
                  key={item.id}
                  groupClass={item}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}