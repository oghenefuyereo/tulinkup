"use client";

// Import React hooks.
import { useEffect, useState } from "react";

// Import Next.js navigation.
import { useRouter } from "next/navigation";

// Import LiveKit classroom components.
import {
  LiveKitRoom,
  VideoConference,
} from "@livekit/components-react";

// Import LiveKit styles.
import "@livekit/components-styles";

// Create the reusable live classroom component.
export default function LiveClassroom({
  type,
  sessionId,
  user: initialUser,
  initialClassroom,
}) {
  const router = useRouter();

  // Manage classroom connection information.
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manage user authentication and classroom access.
  const [user, setUser] = useState(initialUser ?? null);

  const [classroom, setClassroom] = useState(
    initialClassroom ?? null
  );

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");

  // Identify the authenticated participant's role.
  const isTutor = user?.role === "tutor";
  const isStudent = user?.role === "student";

  // Identify the current classroom status.
  const sessionStatus = classroom?.session?.status;
  const classroomStatus = classroom?.classroomStatus;

  const isCompleted =
    sessionStatus === "completed" ||
    classroomStatus === "completed";

  const isCancelled =
    sessionStatus === "cancelled" ||
    classroomStatus === "cancelled";

  const isLive =
    sessionStatus === "live" &&
    !isCompleted &&
    !isCancelled;

  // Check whether the participant meets the payment requirements.
  const paymentEligible =
    classroom?.paymentEligible === true;

  // Check whether the classroom has an active booking or class.
  const isActiveClassroom =
    type === "group"
      ? ["published", "live"].includes(classroomStatus)
      : classroomStatus === "accepted";

  // Determine whether the tutor can request to start the classroom.
  const canStart =
    isTutor &&
    paymentEligible &&
    !isLive &&
    !isCompleted &&
    !isCancelled &&
    isActiveClassroom &&
    classroom?.canStart === true;

  // Determine whether the participant can join.
  const canJoin =
    (isTutor || isStudent) &&
    paymentEligible &&
    isLive &&
    isActiveClassroom &&
    classroom?.canJoin === true;

  // Determine whether the student is waiting for the tutor.
  const isWaitingForTutor =
    isStudent &&
    paymentEligible &&
    !isLive &&
    !isCompleted &&
    !isCancelled &&
    ["published", "accepted"].includes(classroomStatus);

  // Determine whether payment requirements are preventing access.
  const paymentBlocked =
    classroom &&
    !paymentEligible &&
    !isCompleted &&
    !isCancelled;

  // Verify the authenticated user and classroom access.
  useEffect(() => {
    const controller = new AbortController();

    async function checkAccess() {
      try {
        const userResponse = await fetch(
          "/api/auth/me",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        if (userResponse.status === 401) {
          router.replace("/login");
          return;
        }

        const userData = await userResponse
          .json()
          .catch(() => null);

        if (controller.signal.aborted) return;

        if (userResponse.ok && !userData?.user) {
          setUser(null);
          router.replace("/login");
          return;
        }

        if (!userResponse.ok || !userData?.user) {
          throw new Error(
            userData?.error ||
              userData?.message ||
              "Unable to verify your account."
          );
        }

        const currentUser = userData.user;

        if (
          !["student", "tutor"].includes(currentUser.role)
        ) {
          throw new Error(
            "Your account cannot access this classroom."
          );
        }

        // Verify classroom ownership or enrolment.
        const classroomResponse = await fetch(
          `/api/live-sessions/${type}/${sessionId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        if (classroomResponse.status === 401) {
          router.replace("/login");
          return;
        }

        const classroomData = await classroomResponse
          .json()
          .catch(() => null);

        if (
          !classroomResponse.ok ||
          !classroomData?.success
        ) {
          throw new Error(
            classroomData?.message ||
              classroomData?.error ||
              "You cannot access this classroom."
          );
        }

        if (!controller.signal.aborted) {
          setUser(currentUser);
          setClassroom(classroomData);
          setAccessError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnection(null);
          setClassroom(null);

          setAccessError(
            error.message ||
              "Unable to verify classroom access."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingAccess(false);
        }
      }
    }

    checkAccess();

    return () => controller.abort();
  }, [type, sessionId, router]);

  // Automatically refresh classroom status before and during sessions.
  useEffect(() => {
    if (
      !user ||
      loading ||
      checkingAccess ||
      accessError
    ) {
      return;
    }

    const controller = new AbortController();

    let refreshing = false;

    async function refreshClassroom() {
      if (refreshing) return;

      refreshing = true;

      try {
        const response = await fetch(
          `/api/live-sessions/${type}/${sessionId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (controller.signal.aborted) return;

        if (response.ok && data?.success) {
          setClassroom(data);

          // Check whether the classroom has ended.
          const sessionEnded =
            ["completed", "cancelled"].includes(
              data.session?.status
            ) ||
            ["completed", "cancelled"].includes(
              data.classroomStatus
            );

          // Check whether the booking or class remains active.
          const classroomActive =
            type === "group"
              ? ["published", "live"].includes(
                  data.classroomStatus
                )
              : data.classroomStatus === "accepted";

          // Disconnect participants when the classroom ends.
          if (connection && sessionEnded) {
            setConnection(null);
            setError("");
            return;
          }

          // Disconnect students when their access is withdrawn.
          if (
            connection &&
            user.role === "student" &&
            (
              data.paymentEligible !== true ||
              data.canJoin !== true ||
              data.session?.status !== "live" ||
              !classroomActive
            )
          ) {
            setConnection(null);

            setError(
              "Your classroom access is no longer available. Please check your booking or enrolment details."
            );

            return;
          }

          // Allow tutors to end an existing live classroom
          // even when payment eligibility changes.
          if (
            connection &&
            user.role === "tutor" &&
            (
              data.paymentEligible !== true ||
              data.canJoin !== true ||
              !classroomActive
            )
          ) {
            setError(
              "Classroom access requirements are no longer satisfied. Please end the classroom."
            );
          }

        } else if (response.status === 401) {
          setConnection(null);
          setUser(null);
          router.replace("/login");

        } else if (
          [403, 404].includes(response.status)
        ) {
          setConnection(null);
          setClassroom(null);

          setAccessError(
            data?.message ||
              data?.error ||
              "Classroom access is unavailable."
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "Classroom status error:",
            error.message
          );
        }
      } finally {
        refreshing = false;
      }
    }

    refreshClassroom();

    // Check for classroom updates every five seconds.
    const interval = setInterval(
      refreshClassroom,
      5000
    );

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [
    user,
    connection,
    loading,
    checkingAccess,
    accessError,
    type,
    sessionId,
    router,
  ]);

  // Request classroom access from the backend.
  async function connect(action) {
    if (
      loading ||
      checkingAccess ||
      accessError
    ) {
      return;
    }

    // Reject unsupported classroom actions.
    if (!["start", "join"].includes(action)) {
      return;
    }

    // Prevent access when payment requirements are not satisfied.
    if (!paymentEligible) {
      setError(
        "Classroom access requires valid pricing and verified payment."
      );
      return;
    }

    // Only eligible tutors can start classrooms.
    if (action === "start" && !canStart) {
      return;
    }

    // Only eligible participants can join classrooms.
    if (action === "join" && !canJoin) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/live-sessions/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            id: String(sessionId),
          }),
        }
      );

      // Redirect users when their authentication expires.
      if (response.status === 401) {
        setConnection(null);
        router.replace("/login");
        return;
      }

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to access classroom."
        );
      }

      // Validate classroom connection credentials.
      if (!data.token || !data.serverUrl) {
        throw new Error(
          "Invalid classroom connection information."
        );
      }

      // Update the current classroom status.
      setClassroom((previous) => ({
        ...previous,
        session: data.session || previous?.session,
        classroomStatus:
          type === "group"
            ? "live"
            : previous?.classroomStatus,
        canStart: false,
        canJoin: true,
      }));

      // Establish the LiveKit connection.
      setConnection({
        token: data.token,
        serverUrl: data.serverUrl,
      });
    } catch (error) {
      setError(
        error.message ||
          "Unable to connect to the classroom."
      );
    } finally {
      setLoading(false);
    }
  }

  // Allow participants to leave without ending the classroom.
  function leaveClassroom() {
    if (loading) return;

    setConnection(null);
    setError("");
  }

  // Allow only the tutor to end the classroom.
  async function endClassroom() {
    if (!isTutor || loading || !isLive) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to end this classroom for everyone?"
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/live-sessions/end",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            id: String(sessionId),
          }),
        }
      );

      // Redirect users when their authentication expires.
      if (response.status === 401) {
        setConnection(null);
        router.replace("/login");
        return;
      }

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to end classroom."
        );
      }

      // Update the classroom status before disconnecting.
      setClassroom((previous) => ({
        ...previous,
        session: {
          ...previous?.session,
          ...data.session,
          status: "completed",
        },
        classroomStatus: "completed",
        canStart: false,
        canJoin: false,
      }));

      setConnection(null);
      router.back();
    } catch (error) {
      setError(
        error.message ||
          "Unable to end the classroom."
      );
    } finally {
      setLoading(false);
    }
  }

  // Display the classroom access verification screen.
  if (checkingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd] p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-extrabold text-[#17233d]">
            TuLinkUp Classroom
          </h1>

          <p className="mt-4 text-sm text-[#64748b]">
            Verifying classroom access...
          </p>
        </div>
      </main>
    );
  }

  // Prevent unauthorized classroom access.
  if (accessError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd] p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-extrabold text-[#17233d]">
            Classroom Unavailable
          </h1>

          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {accessError ||
              "You must sign in to access this classroom."}
          </p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 rounded-xl bg-[#26469b] px-5 py-3 font-bold text-white"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  // Display the classroom entry screen.
  if (!connection) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd] p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-extrabold text-[#17233d]">
            TuLinkUp Classroom
          </h1>

          <p className="mt-3 text-sm text-[#64748b]">
            {type === "group"
              ? "Group Live Class"
              : "One-on-One Tutoring Session"}
          </p>

          {/* Display participant information. */}
          <div className="mt-5 rounded-xl bg-[#f7f9fd] p-4">
            <p className="text-sm font-bold text-[#17233d]">
              {user.full_name ||
                user.fullName ||
                "Participant"}
            </p>

            <p className="mt-1 text-xs capitalize text-[#64748b]">
              Joining as {user.role}
            </p>
          </div>

          {/* Display the live classroom status. */}
          {isLive && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" />
              Classroom is live
            </div>
          )}

          {/* Display completed classroom status. */}
          {isCompleted && (
            <p className="mt-4 rounded-xl bg-gray-100 p-4 text-sm font-bold">
              This classroom has ended.
            </p>
          )}

          {/* Display cancelled classroom status. */}
          {isCancelled && (
            <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
              This classroom has been cancelled.
            </p>
          )}

          {/* Display verified payment eligibility. */}
          {paymentEligible &&
            !isCompleted &&
            !isCancelled && (
              <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                <p className="font-bold">
                  Payment requirements satisfied
                </p>

                <p className="mt-1 text-xs leading-5">
                  The payment requirements for this
                  classroom have been verified.
                </p>
              </div>
            )}

          {/* Display payment restrictions. */}
          {paymentBlocked && (
            <div className="mt-4 rounded-xl bg-[#fff8dc] p-4 text-sm text-[#725b00]">
              <p className="font-bold">
                Classroom access restricted
              </p>

              <p className="mt-2 text-xs leading-5">
                Classroom access requires valid pricing
                and verified payment where applicable.
                Please check your{" "}
                {type === "group"
                  ? "enrolment"
                  : "booking"}{" "}
                details.
              </p>

              <p className="mt-2 text-xs leading-5">
                This page updates automatically when
                your access requirements are satisfied.
              </p>
            </div>
          )}

          {/* Display classroom errors. */}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {/* Only eligible tutors can start classrooms. */}
            {canStart && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => connect("start")}
                  className="rounded-xl bg-[#26469b] px-5 py-3 font-bold text-white hover:bg-[#173472] disabled:opacity-50"
                >
                  {loading
                    ? "Connecting..."
                    : "Start Classroom"}
                </button>

                <p className="text-center text-xs text-[#64748b]">
                  Classroom access is available within
                  the permitted scheduled access window.
                </p>
              </>
            )}

            {/* Eligible participants can join classrooms. */}
            {canJoin && (
              <button
                type="button"
                disabled={loading}
                onClick={() => connect("join")}
                className="rounded-xl bg-[#26469b] px-5 py-3 font-bold text-white hover:bg-[#173472] disabled:opacity-50"
              >
                {loading
                  ? "Connecting..."
                  : "Join Classroom"}
              </button>
            )}

            {/* Students wait until the tutor starts. */}
            {isWaitingForTutor && (
              <>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl bg-gray-100 px-5 py-3 font-bold text-gray-500"
                >
                  Waiting for Tutor
                </button>

                <p className="text-center text-xs leading-5 text-[#64748b]">
                  The classroom will become available
                  when your tutor starts the session.
                  This page updates automatically.
                </p>
              </>
            )}

            {/* Display payment access restrictions. */}
            {paymentBlocked && (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl bg-gray-100 px-5 py-3 font-bold text-gray-500"
              >
                Classroom Access Restricted
              </button>
            )}

            {/* Display classroom access restrictions. */}
            {isLive &&
              paymentEligible &&
              !canJoin && (
                <p className="rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-700">
                  Classroom access is currently unavailable.
                  Please check your scheduled session time.
                </p>
              )}

            {/* Inform tutors when the classroom cannot be started yet. */}
            {isTutor &&
              paymentEligible &&
              isActiveClassroom &&
              !isLive &&
              !isCompleted &&
              !isCancelled &&
              !canStart && (
                <p className="rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-700">
                  You cannot start this classroom yet.
                  Please check your scheduled session time.
                  This page updates automatically.
                </p>
              )}

            {!isLive &&
              !isCompleted &&
              !isCancelled &&
              !paymentBlocked &&
              !canStart &&
              !isWaitingForTutor &&
              !(isTutor && isActiveClassroom) && (
                <p className="rounded-xl bg-gray-100 p-4 text-center text-sm font-bold">
                  This classroom is not ready for access.
                </p>
              )}

            {/* Allow tutors to end a live classroom without reconnecting. */}
            {isTutor && isLive && (
              <button
                type="button"
                disabled={loading}
                onClick={endClassroom}
                className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading
                  ? "Ending Classroom..."
                  : "End Classroom"}
              </button>
            )}

            {/* Allow participants to return to their dashboard. */}
            {paymentBlocked && (
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  router.push(
                    isTutor
                      ? "/dashboard/tutor"
                      : "/dashboard/student"
                  )
                }
                className="rounded-xl border border-[#dce2ec] px-5 py-3 text-sm font-bold text-[#26469b] disabled:opacity-50"
              >
                View Dashboard
              </button>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => router.back()}
              className="px-5 py-3 text-sm font-bold text-[#64748b] disabled:opacity-50"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Display the connected LiveKit classroom.
  return (
    <main className="flex h-dvh flex-col bg-[#111827]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 p-4 text-white">
        <div>
          <h1 className="text-xl font-extrabold">
            TuLinkUp Live Classroom
          </h1>

          <p className="text-sm capitalize text-gray-400">
            {type === "group"
              ? "Group Live Class"
              : "One-on-One Tutoring"}

            {" · "}

            {user.role}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Allow participants to leave individually. */}
          <button
            type="button"
            disabled={loading}
            onClick={leaveClassroom}
            className="rounded-xl border border-gray-500 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Leave Classroom
          </button>

          {/* Only tutors can end classrooms for everyone. */}
          {isTutor && (
            <button
              type="button"
              disabled={loading}
              onClick={endClassroom}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading
                ? "Ending Classroom..."
                : "End Classroom"}
            </button>
          )}
        </div>
      </header>

      {/* Display connection errors. */}
      {error && (
        <p
          role="alert"
          className="bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Render the LiveKit video classroom. */}
      <div className="min-h-0 flex-1">
        <LiveKitRoom
          token={connection.token}
          serverUrl={connection.serverUrl}
          connect={true}
          video={false}
          audio={false}
          data-lk-theme="default"
          style={{ height: "100%" }}
          onDisconnected={() => {
            setConnection(null);
          }}
          onError={(error) => {
            setError(error.message);
          }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </main>
  );
}