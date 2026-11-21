"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const MAX_GROUP_PRICE_CENTS = 1000;
const MAX_GROUP_STUDENTS = 20;
const MAX_GROUP_REVENUE_CENTS = 10000;
const MIN_GROUP_CAPACITY = 2;

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(cents) / 100);
}

// Check whether the class follows the platform pricing rules.
function hasValidClassPricing(groupClass) {
  if (!groupClass || groupClass.price_cents == null) {
    return false;
  }

  const priceCents = Number(groupClass.price_cents);
  const capacity = Number(groupClass.maximum_students);
  const minimumStudents = Number(groupClass.minimum_students);

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

// Retrieve the agreed price from the enrolment record.
function getEnrollmentPrice(enrollment, groupClass) {
  return Number(
    enrollment?.enrollment_price_cents ??
      enrollment?.price_cents ??
      groupClass.price_cents
  );
}

export default function GroupClassDetails({ classId }) {
  const [groupClass, setGroupClass] = useState(null);
  const [user, setUser] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");

  // Load the class and authenticated user.
  useEffect(() => {
    const controller = new AbortController();

    async function loadDetails() {
      setLoading(true);
      setError("");
      setSuccess("");
      setEnrollmentError("");

      try {
        const [classResponse, userResponse] =
          await Promise.all([
            fetch(`/api/group-classes/${classId}`, {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch("/api/auth/me", {
              cache: "no-store",
              signal: controller.signal,
            }),
          ]);

        const classData = await classResponse.json();

        if (!classResponse.ok || !classData.success) {
          throw new Error(
            classData.message || "Group class not found."
          );
        }

        if (controller.signal.aborted) return;

        setGroupClass(classData.groupClass);
        setUser(null);
        setEnrolled(false);
        setEnrollment(null);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const currentUser = userData.user || null;

          if (controller.signal.aborted) return;

          setUser(currentUser);

          // Check whether the student is already enrolled.
          if (currentUser?.role === "student") {
            try {
              const enrollmentResponse = await fetch(
                "/api/group-classes/my-enrollments",
                {
                  cache: "no-store",
                  signal: controller.signal,
                }
              );

              const enrollmentData =
                await enrollmentResponse.json();

              if (
                !enrollmentResponse.ok ||
                !enrollmentData.success
              ) {
                throw new Error(
                  "Unable to verify your enrolment."
                );
              }

              // Retrieve the student's full enrolment record.
              const currentEnrollment = (
                enrollmentData.enrollments || []
              ).find(
                (item) =>
                  String(item.id) === String(classId)
              );

              const alreadyEnrolled =
                currentEnrollment &&
                ["confirmed", "attended", "absent"].includes(
                  currentEnrollment.enrollment_status
                );

              if (!controller.signal.aborted) {
                setEnrollment(currentEnrollment || null);
                setEnrolled(Boolean(alreadyEnrolled));
              }
            } catch (error) {
              if (!controller.signal.aborted) {
                setEnrollmentError(error.message);
              }
            }
          }
        } else if (userResponse.status !== 401) {
          setEnrollmentError(
            "Unable to verify your account. Refresh to try again."
          );
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

    loadDetails();

    return () => controller.abort();
  }, [classId]);

  // Enrol the student in a free group class.
  async function handleEnrollment() {
    if (
      processing ||
      enrolled ||
      enrollmentError ||
      user?.role !== "student" ||
      !groupClass ||
      groupClass.status !== "published" ||
      new Date(groupClass.scheduled_at) <= new Date()
    ) {
      return;
    }

    // Verify the class pricing and capacity.
    if (!hasValidClassPricing(groupClass)) {
      setEnrollmentError(
        "This class does not meet the platform pricing requirements."
      );
      return;
    }

    // Paid enrolments require payment integration.
    if (Number(groupClass.price_cents) !== 0) {
      setEnrollmentError(
        "Paid enrolment is not available yet."
      );
      return;
    }

    // Prevent enrolment when the class is full.
    if (
      Number(groupClass.enrolled_students || 0) >=
      Number(groupClass.maximum_students)
    ) {
      setEnrollmentError("This group class is full.");
      return;
    }

    // Prevent duplicate or ineligible enrolments.
    if (
      enrollment &&
      enrollment.enrollment_status !== "cancelled"
    ) {
      setEnrollmentError(
        "An enrolment already exists for this class."
      );
      return;
    }

    // Verify that a cancelled enrolment can be reactivated.
    if (
      enrollment?.enrollment_status === "cancelled" &&
      (
        Number(enrollment.amount_paid_cents) !== 0 ||
        !["not_required", "unpaid", "failed"].includes(
          enrollment.payment_status
        )
      )
    ) {
      setEnrollmentError(
        "Your previous enrolment requires payment review."
      );
      return;
    }

    setProcessing(true);
    setEnrollmentError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/group-classes/${classId}/enroll`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to enrol in class."
        );
      }

      setEnrolled(true);

      // Store the enrolment returned by the backend.
      setEnrollment(data.enrollment || null);

      setGroupClass((previous) => ({
        ...previous,
        enrolled_students:
          Number(previous.enrolled_students || 0) + 1,
      }));

      setSuccess(
        data.message ||
          "You have successfully enrolled in this group class!"
      );
    } catch (error) {
      setEnrollmentError(error.message);
    } finally {
      setProcessing(false);
    }
  }

  // Loading state.
  if (loading) {
    return (
      <div className="panel p-12 text-center">
        Loading group class...
      </div>
    );
  }

  // Error state.
  if (error || !groupClass) {
    return (
      <div className="panel space-y-4 p-10 text-center">
        <h1 className="text-2xl font-extrabold">
          Class unavailable
        </h1>

        <p className="text-sm text-red-600">
          {error || "This class could not be found."}
        </p>

        <Link
          href="/group-classes"
          className="btn-primary inline-block"
        >
          Browse Group Classes
        </Link>
      </div>
    );
  }

  // Calculate class information.
  const capacity = Number(
    groupClass.maximum_students || 0
  );

  const totalEnrolled = Number(
    groupClass.enrolled_students || 0
  );

  const remaining = Math.max(
    0,
    capacity - totalEnrolled
  );

  const isFull = remaining === 0;

  const priceCents = Number(groupClass.price_cents);

  const isFree = priceCents === 0;

  const pricingIsValid =
    hasValidClassPricing(groupClass);

  // Identify the current classroom status.
  const isLive = groupClass.status === "live";
  const isPublished = groupClass.status === "published";
  const isCompleted = groupClass.status === "completed";
  const isCancelled = groupClass.status === "cancelled";

  // Verify that the student's enrolment is confirmed.
  const isConfirmed =
    enrollment?.enrollment_status === "confirmed";

  // Use the agreed enrolment price for existing students.
  const enrollmentPriceCents = getEnrollmentPrice(
    enrollment,
    groupClass
  );

  const enrollmentCurrency =
    enrollment?.enrollment_currency ??
    enrollment?.currency ??
    groupClass.currency;

  // Verify the student's payment eligibility.
  const hasValidPayment =
    Boolean(enrollment) &&
    enrollmentCurrency === "CAD" &&
    Number.isInteger(enrollmentPriceCents) &&
    enrollmentPriceCents >= 0 &&
    enrollmentPriceCents <= MAX_GROUP_PRICE_CENTS &&
    (
      (
        enrollmentPriceCents === 0 &&
        enrollment.payment_status === "not_required"
      ) ||
      (
        enrollmentPriceCents > 0 &&
        enrollment.payment_status === "paid" &&
        Number(enrollment.amount_paid_cents) >=
          enrollmentPriceCents
      )
    );

  // Determine whether the student can join the live classroom.
  const canJoin =
    user?.role === "student" &&
    enrolled &&
    isConfirmed &&
    hasValidPayment &&
    isLive;

  // Determine whether the student is waiting for the tutor.
  const isWaitingForTutor =
    user?.role === "student" &&
    enrolled &&
    isConfirmed &&
    hasValidPayment &&
    isPublished;

  // Identify cancelled enrolments eligible for re-enrolment.
  const canReEnroll =
    enrollment?.enrollment_status === "cancelled" &&
    pricingIsValid &&
    isFree &&
    Number(enrollment.amount_paid_cents) === 0 &&
    ["not_required", "unpaid", "failed"].includes(
      enrollment.payment_status
    );

  const scheduledDate = new Date(
    groupClass.scheduled_at
  );

  const isPast = scheduledDate <= new Date();

  const price = formatCurrency(priceCents);

  const percentage =
    capacity > 0
      ? Math.min(100, (totalEnrolled / capacity) * 100)
      : 0;

  const classDate = scheduledDate.toLocaleDateString(
    "en-CA",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );

  const classTime = scheduledDate.toLocaleTimeString(
    "en-CA",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }
  );

  return (
    <div className="space-y-6">
      <Link
        href="/group-classes"
        className="text-sm font-bold text-[#26469b]"
      >
        ← Back to Group Classes
      </Link>

      {/* Success message */}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm font-semibold text-green-700"
        >
          {success}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
        {/* Main class information */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#173472] to-[#4269c5] p-8 text-white md:p-12">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                Group Live Class
              </span>

              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                {groupClass.education_level}
              </span>

              {/* Display the active classroom indicator. */}
              {isLive && (
                <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Live Now
                </span>
              )}

              {/* Display completed classroom status. */}
              {isCompleted && (
                <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
                  Completed
                </span>
              )}

              {/* Display cancelled classroom status. */}
              {isCancelled && (
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  Cancelled
                </span>
              )}
            </div>

            <p className="mt-8 text-sm font-semibold text-blue-100">
              {groupClass.subject}
            </p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
              {groupClass.title}
            </h1>

            <p className="mt-4 text-blue-100">
              Hosted by {groupClass.tutor_name || "Tutor"}
            </p>
          </div>

          {/* About the class */}
          <section className="panel p-6">
            <h2 className="text-xl font-extrabold">
              About This Class
            </h2>

            <p className="mt-4 whitespace-pre-wrap leading-7 text-[#64748b]">
              {groupClass.description}
            </p>
          </section>

          {/* Schedule */}
          <section className="panel p-6">
            <h2 className="text-xl font-extrabold">
              Class Schedule
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                ["Date", classDate],
                ["Start time", classTime],
                [
                  "Duration",
                  `${groupClass.duration_minutes} minutes`,
                ],
                ["Class format", "Online group session"],
                ["Subject", groupClass.subject],
                [
                  "Education level",
                  groupClass.education_level,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-[#f7f9fd] p-4"
                >
                  <p className="text-xs font-bold uppercase text-[#8190a8]">
                    {label}
                  </p>

                  <p className="mt-2 text-sm font-bold">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Tutor information */}
          <section className="panel p-6">
            <h2 className="text-xl font-extrabold">
              Meet Your Tutor
            </h2>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eaf0ff] text-2xl font-extrabold text-[#26469b]">
                {(groupClass.tutor_name || "T")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h3 className="text-lg font-extrabold">
                  {groupClass.tutor_name || "Tutor"}
                </h3>

                <p className="text-sm text-[#64748b]">
                  {groupClass.subject} · Group class tutor
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Enrollment sidebar */}
        <aside>
          <div className="panel space-y-6 p-6 lg:sticky lg:top-24">
            <div>
              <p className="text-sm text-[#64748b]">
                Price per student
              </p>

              <p className="mt-2 text-4xl font-extrabold text-[#173472]">
                {isFree ? "Free" : `${price} CAD`}
              </p>

              <p className="mt-2 text-xs text-[#64748b]">
                {isFree
                  ? "No payment is required for this session."
                  : "One-time price for the entire live session."}
              </p>
            </div>

            {/* Display the student's agreed enrolment price. */}
            {enrollment &&
              enrollment.enrollment_status !== "cancelled" &&
              (
                enrollment.enrollment_price_cents != null ||
                enrollment.price_cents != null
              ) && (
                <div className="rounded-xl bg-[#f7f9fd] p-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#64748b]">
                      Your enrolment price
                    </span>

                    <span className="font-bold text-[#173472]">
                      {enrollmentPriceCents === 0
                        ? "Free"
                        : `${formatCurrency(
                            enrollmentPriceCents
                          )} CAD`}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-3 text-sm">
                    <span className="text-[#64748b]">
                      Payment status
                    </span>

                    <span className="font-bold capitalize">
                      {enrollment.payment_status === "not_required"
                        ? "Not required"
                        : enrollment.payment_status
                            ?.replaceAll("_", " ") || "Unknown"}
                    </span>
                  </div>
                </div>
              )}

            <hr className="border-[#edf0f5]" />

            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">
                  Duration
                </span>

                <span className="font-bold">
                  {groupClass.duration_minutes} minutes
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">
                  Maximum students
                </span>

                <span className="font-bold">
                  {capacity}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">
                  Minimum students
                </span>

                <span className="font-bold">
                  {groupClass.minimum_students}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">
                  Enrolled
                </span>

                <span className="font-bold">
                  {totalEnrolled}
                </span>
              </div>

              {/* Display the current class status. */}
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">
                  Class status
                </span>

                <span className="font-bold capitalize">
                  {groupClass.status}
                </span>
              </div>
            </div>

            {/* Class capacity */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold">
                  Available seats
                </span>

                <span className="font-bold text-[#26469b]">
                  {remaining} left
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-[#edf0f5]"
                role="progressbar"
                aria-label="Class capacity"
                aria-valuemin={0}
                aria-valuemax={capacity || 1}
                aria-valuenow={Math.max(
                  0,
                  Math.min(totalEnrolled, capacity)
                )}
              >
                <div
                  className="h-full rounded-full bg-[#26469b]"
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>

            {!pricingIsValid &&
              !isCancelled &&
              !isCompleted && (
                <p
                  role="alert"
                  className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700"
                >
                  This class requires a pricing review before
                  accepting new enrolments.
                </p>
              )}

            {enrollmentError && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {enrollmentError}
              </p>
            )}

            {/* Enrollment action */}
            {isCancelled ? (
              <p className="rounded-xl bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                This class has been cancelled.
              </p>
            ) : isCompleted ? (
              <p className="rounded-xl bg-green-50 p-4 text-center text-sm font-bold text-green-700">
                This learning session has ended.
              </p>
            ) : enrolled ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-green-50 p-4 text-center text-sm font-bold text-green-700">
                  You are enrolled!
                </div>

                {/* Allow eligible students to join the live classroom. */}
                {canJoin && (
                  <Link
                    href={`/classroom/group/${classId}`}
                    className="block rounded-xl bg-[#26469b] px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-[#173472]"
                  >
                    Join Live Class
                  </Link>
                )}

                {/* Display the waiting button before the tutor starts. */}
                {isWaitingForTutor && (
                  <button
                    type="button"
                    disabled
                    title="The tutor has not started the classroom."
                    className="w-full cursor-not-allowed rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white opacity-50"
                  >
                    Waiting for Tutor
                  </button>
                )}

                {/* Display outstanding payment requirements. */}
                {isConfirmed && !hasValidPayment && (
                  <p className="rounded-xl bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">
                    Your payment or enrolment details must
                    be verified before joining the classroom.
                  </p>
                )}

                {/* Display classroom eligibility information. */}
                {!isConfirmed && (
                  <p className="rounded-xl bg-gray-100 p-3 text-center text-xs font-semibold">
                    Your current enrolment status does not
                    allow classroom access.
                  </p>
                )}

                <Link
                  href="/dashboard/student/group-classes"
                  className="block rounded-xl border border-[#dce3ee] px-5 py-3 text-center text-sm font-bold text-[#26469b] hover:bg-[#f7f9fd]"
                >
                  View My Classes
                </Link>
              </div>
            ) : !user && isLive ? (
              <Link
                href="/login"
                className="block rounded-xl bg-[#26469b] px-5 py-3 text-center text-sm font-bold text-white"
              >
                Sign In to Check Access
              </Link>
            ) : isLive ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                This class is currently live. Only eligible
                enrolled students can join.
              </p>
            ) : !isPublished ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                This class is not open for enrolment.
              </p>
            ) : isPast ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                This class has already started or passed.
              </p>
            ) : !pricingIsValid ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                Enrolment is temporarily unavailable.
              </p>
            ) : isFull ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                This class is full.
              </p>
            ) : !user ? (
              <Link
                href="/login"
                className="block rounded-xl bg-[#26469b] px-5 py-3 text-center text-sm font-bold text-white"
              >
                Sign In to Enrol
              </Link>
            ) : user.role !== "student" ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm">
                Only student accounts can enrol.
              </p>
            ) : enrollment?.enrollment_status === "pending" ? (
              <p className="rounded-xl bg-amber-50 p-4 text-center text-sm font-bold text-amber-700">
                Your enrolment is pending confirmation.
              </p>
            ) : !isFree ? (
              <div className="rounded-xl bg-[#f0f4ff] p-4 text-center text-sm text-[#26469b]">
                <p className="font-bold">
                  Paid enrolment is coming soon.
                </p>

                <p className="mt-2 text-xs">
                  Online payments are not available yet.
                  Please explore our free group classes.
                </p>
              </div>
            ) : enrollment?.enrollment_status === "cancelled" &&
              !canReEnroll ? (
              <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                Your previous enrolment requires review
                before you can re-enrol.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleEnrollment}
                disabled={processing || Boolean(enrollmentError)}
                className="w-full rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white hover:bg-[#173472] disabled:opacity-50"
              >
                {processing
                  ? "Enrolling..."
                  : canReEnroll
                    ? "Re-enrol in Free Class"
                    : "Enrol in Free Class"}
              </button>
            )}

            {/* Display the live classroom availability notice. */}
            {canJoin && (
              <p className="text-center text-xs font-semibold leading-5 text-green-700">
                Your tutor has started the live classroom.
                You can join the session, subject to the
                scheduled access window.
              </p>
            )}

            {/* Display the waiting classroom notice. */}
            {isWaitingForTutor && (
              <p className="text-center text-xs leading-5 text-[#64748b]">
                The classroom will become available when
                your tutor starts the live session.
                Refresh this page to check for updates.
              </p>
            )}

            {/* Display information about live classroom access. */}
            {!enrolled && isPublished && (
              <p className="text-center text-xs leading-5 text-[#64748b]">
                Live classroom access is available to
                eligible students with confirmed enrolments
                when the tutor starts the session.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}