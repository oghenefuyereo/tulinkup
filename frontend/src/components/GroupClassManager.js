"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BASE_PATH = "/dashboard/tutor/group-classes";

const statusStyles = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  live: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function GroupClassManager() {
  const router = useRouter();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [processingId, setProcessingId] = useState(null);

  // Load the signed-in tutor's group classes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadClasses() {
      try {
        const response = await fetch(
          "/api/group-classes/me",
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

  // Publish or cancel a group class.
  async function updateStatus(id, status) {
    if (processingId !== null) return;

    if (status === "cancelled") {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this class?"
      );

      if (!confirmed) return;
    }

    setProcessingId(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/group-classes/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to update class."
        );
      }

      setClasses((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                ...data.groupClass,
                status,
                enrolled_students:
                  status === "cancelled"
                    ? 0
                    : item.enrolled_students,
              }
            : item
        )
      );

      setSuccess(
        status === "published"
          ? "Your class has been published successfully."
          : "Your class has been cancelled."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessingId(null);
    }
  }

  // Open the live classroom page.
  function openClassroom(id) {
    if (processingId !== null) return;

    router.push(`/classroom/group/${id}`);
  }

  // Allow the assigned tutor to end a live classroom.
  async function endLiveClass(id) {
    if (processingId !== null) return;

    // Confirm before ending the classroom for everyone.
    const confirmed = window.confirm(
      "Are you sure you want to end this live class for everyone?"
    );

    if (!confirmed) return;

    setProcessingId(id);
    setError("");
    setSuccess("");

    try {
      // Send the request to the Live Session API.
      const response = await fetch(
        "/api/live-sessions/end",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "group",
            id: String(id),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to end live class."
        );
      }

      // Update the completed class in the dashboard.
      setClasses((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "completed",
              }
            : item
        )
      );

      // Display a success message.
      setSuccess(
        data.message ||
          "Your live class has ended successfully."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessingId(null);
    }
  }

  // Dashboard statistics.
  const publishedClasses = classes.filter(
    (item) => item.status === "published"
  );

  const draftClasses = classes.filter(
    (item) => item.status === "draft"
  );

  const totalStudents = classes.reduce(
    (total, item) =>
      total + Number(item.enrolled_students || 0),
    0
  );

  const potentialRevenue = publishedClasses.reduce(
    (total, item) =>
      total +
      Number(item.price_cents || 0) *
        Number(item.maximum_students || 0),
    0
  );

  const statistics = [
    {
      label: "Total classes",
      value: classes.length,
    },
    {
      label: "Published classes",
      value: publishedClasses.length,
    },
    {
      label: "Draft classes",
      value: draftClasses.length,
    },
    {
      label: "Total enrolments",
      value: totalStudents,
    },
  ];

  const filteredClasses =
    filter === "all"
      ? classes
      : classes.filter((item) => item.status === filter);

  return (
    <div className="space-y-6">
      {/* Dashboard heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#17233d]">
            Group Live Classes
          </h1>

          <p className="mt-2 text-sm text-[#64748b]">
            Create and manage affordable group learning
            sessions for your students.
          </p>
        </div>

        <Link
          href={`${BASE_PATH}/create`}
          className="rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white hover:bg-[#173472]"
        >
          + Create Class
        </Link>
      </div>

      {/* Error and success messages */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-[#64748b]">
            Loading your group classes...
          </p>
        </div>
      ) : (
        <>
          {/* Dashboard statistics */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {statistics.map((item) => (
              <div
                key={item.label}
                className="panel p-5"
              >
                <p className="text-sm font-medium text-[#64748b]">
                  {item.label}
                </p>

                <p className="mt-2 text-3xl font-extrabold text-[#17233d]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Potential revenue */}
          <div className="rounded-2xl border border-[#dce6fa] bg-[#f0f4ff] p-6">
            <p className="text-sm font-bold text-[#26469b]">
              Potential gross revenue
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#17233d]">
              {formatCurrency(potentialRevenue)}
            </p>

            <p className="mt-2 text-xs text-[#64748b]">
              Estimated revenue if all published classes
              reach full capacity. Payments are not
              enabled yet.
            </p>
          </div>

          {/* Class filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">
              Your classes
            </h2>

            <select
              aria-label="Filter group classes"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              className="rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm font-bold"
            >
              <option value="all">All classes</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Empty state */}
          {filteredClasses.length === 0 ? (
            <div className="panel p-10 text-center">
              <h3 className="text-xl font-extrabold">
                {classes.length === 0
                  ? "No group classes yet"
                  : "No matching classes"}
              </h3>

              <p className="mt-2 text-sm text-[#64748b]">
                {error
                  ? "Unable to display your classes. Refresh the page to try again."
                  : classes.length === 0
                    ? "Create your first group live class."
                    : "Try selecting a different filter."}
              </p>

              {!error && classes.length === 0 && (
                <Link
                  href={`${BASE_PATH}/create`}
                  className="mt-5 inline-block rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white"
                >
                  Create Your First Class
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredClasses.map((item) => {
                const enrolled = Number(
                  item.enrolled_students || 0
                );

                const capacity = Number(
                  item.maximum_students || 0
                );

                const remaining = Math.max(
                  0,
                  capacity - enrolled
                );

                const percentage =
                  capacity > 0
                    ? Math.min(
                        100,
                        (enrolled / capacity) * 100
                      )
                    : 0;

                return (
                  <article
                    key={item.id}
                    className="panel space-y-5 p-6"
                  >
                    {/* Class title and status */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-extrabold text-[#17233d]">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-sm text-[#64748b]">
                          {item.subject} ·{" "}
                          {item.education_level}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                          statusStyles[item.status] ||
                          statusStyles.draft
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Class description */}
                    <p className="line-clamp-2 text-sm leading-6 text-[#64748b]">
                      {item.description}
                    </p>

                    {/* Schedule and pricing */}
                    <div className="grid gap-4 rounded-xl bg-[#f7f9fd] p-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold text-[#8190a8]">
                          DATE AND TIME
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {formatDate(item.scheduled_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-[#8190a8]">
                          DURATION
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {item.duration_minutes} minutes
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-[#8190a8]">
                          PRICE PER STUDENT
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {Number(item.price_cents) === 0
                            ? "Free"
                            : `${formatCurrency(
                                item.price_cents
                              )} CAD`}
                        </p>
                      </div>
                    </div>

                    {/* Student capacity */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">
                          {enrolled}/{capacity} enrolled
                        </span>

                        <span className="text-[#64748b]">
                          {item.status === "cancelled"
                            ? "Class cancelled"
                            : `${remaining} seats remaining`}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#e5eaf3]">
                        <div
                          className="h-full rounded-full bg-[#26469b] transition-all"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Class actions */}
                    <div className="flex flex-wrap gap-3 border-t border-[#edf0f5] pt-4">

                      {/* Allow tutors to start a published live class. */}
                      {item.status === "published" && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            openClassroom(item.id)
                          }
                          className="rounded-xl bg-[#26469b] px-4 py-2 text-sm font-bold text-white hover:bg-[#173472] disabled:opacity-50"
                        >
                          Start Live Class
                        </button>
                      )}

                      {/* Allow tutors to rejoin an active live class. */}
                      {item.status === "live" && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            openClassroom(item.id)
                          }
                          className="rounded-xl bg-[#26469b] px-4 py-2 text-sm font-bold text-white hover:bg-[#173472] disabled:opacity-50"
                        >
                          Join Live Class
                        </button>
                      )}

                      <Link
                        href={`${BASE_PATH}/${item.id}/students`}
                        className="rounded-xl border border-[#dce3ee] px-4 py-2 text-sm font-bold text-[#26469b]"
                      >
                        View Students
                      </Link>

                      {item.status === "draft" && (
                        <>
                          <Link
                            href={`${BASE_PATH}/${item.id}/edit`}
                            className="rounded-xl border border-[#dce3ee] px-4 py-2 text-sm font-bold text-[#26469b]"
                          >
                            Edit Class
                          </Link>

                          <button
                            type="button"
                            disabled={processingId !== null}
                            onClick={() =>
                              updateStatus(
                                item.id,
                                "published"
                              )
                            }
                            className="rounded-xl bg-[#26469b] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {processingId === item.id
                              ? "Processing..."
                              : "Publish Class"}
                          </button>
                        </>
                      )}

                      {["draft", "published"].includes(
                        item.status
                      ) && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            updateStatus(
                              item.id,
                              "cancelled"
                            )
                          }
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel Class
                        </button>
                      )}

                      {/* Allow tutors to end an active live class. */}
                      {item.status === "live" && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            endLiveClass(item.id)
                          }
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {processingId === item.id
                            ? "Ending Class..."
                            : "End Live Class"}
                        </button>
                      )}
                    </div>

                    {/* Live classroom integration notice */}
                    {["published", "live"].includes(
                      item.status
                    ) && (
                      <p className="text-xs text-[#64748b]">
                        {item.status === "live"
                          ? "Your live classroom is active."
                          : "Live classroom access is available 15 minutes before the scheduled class."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}