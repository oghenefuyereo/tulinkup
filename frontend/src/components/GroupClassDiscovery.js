
"use client";

import { useEffect, useState } from "react";
import GroupClassCard from "./GroupClassCard";

export default function GroupClassDiscovery() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("upcoming");

  const inputClass =
    "w-full rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm outline-none focus:border-[#26469b]";

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
          setClasses(data.classes || []);
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

  const subjects = [
    ...new Set(
      classes.map((item) => item.subject).filter(Boolean)
    ),
  ].sort();

  const levels = [
    ...new Set(
      classes
        .map((item) => item.education_level)
        .filter(Boolean)
    ),
  ].sort();

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
          Number(item.price_cents) === 0) ||
        (price === "paid" &&
          Number(item.price_cents) > 0);

      return (
        matchesSearch &&
        matchesSubject &&
        matchesLevel &&
        matchesPrice
      );
    })
    .sort((a, b) => {
      if (sort === "price-low") {
        return a.price_cents - b.price_cents;
      }

      if (sort === "price-high") {
        return b.price_cents - a.price_cents;
      }

      if (sort === "popular") {
        return (
          Number(b.enrolled_students) -
          Number(a.enrolled_students)
        );
      }

      return (
        new Date(a.scheduled_at) -
        new Date(b.scheduled_at)
      );
    });

  function clearFilters() {
    setSearch("");
    setSubject("all");
    setLevel("all");
    setPrice("all");
    setSort("upcoming");
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
              Price
            </span>

            <select
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              className={inputClass}
            >
              <option value="all">All prices</option>
              <option value="free">Free classes</option>
              <option value="paid">Paid classes</option>
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
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-bold text-[#26469b]"
        >
          Clear all filters
        </button>
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

            <p className="text-sm text-[#64748b]">
              {filteredClasses.length} classes found
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
