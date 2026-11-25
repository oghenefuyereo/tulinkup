"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const reasons = [
  ["ADMINISTRATIVE_REVIEW", "Administrative review"],
  ["VERIFICATION_COMPLETED", "Verification completed"],
  ["VERIFICATION_FAILED", "Verification failed"],
  ["POLICY_VIOLATION", "Policy violation"],
  ["SAFETY_CONCERN", "Safety concern"],
  ["ACCOUNT_REQUEST", "Account request"],
  ["ACCOUNT_RESTORED", "Account restored"],
  ["DUPLICATE_ACCOUNT", "Duplicate account"],
  ["PLATFORM_CONFIGURATION", "Platform configuration"],
  ["SCHEDULING_ISSUE", "Scheduling issue"],
  ["SERVICE_UNAVAILABLE", "Service unavailable"],
  ["OTHER_ADMINISTRATIVE_REASON", "Other administrative reason"],
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm";

const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed";

const actionLabels = {
  active: "Reactivate",
  suspended: "Suspend",
  removed: "Remove",
};

function validId(value) {
  return typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validNullableNumber(value, maximum) {
  return value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maximum);
}

// Validate tutor statistics before displaying administrative records.
function validTutorStatistics(user) {
  return typeof user.hasProfile === "boolean" &&
    (user.hasProfile
      ? validId(user.profileId) &&
        ["pending", "approved", "rejected"].includes(user.approvalStatus)
      : user.profileId === null &&
        user.approvalStatus === null) &&
    (user.availabilityStatus === null ||
      typeof user.availabilityStatus === "string") &&
    validNullableNumber(user.hourlyRate, 25) &&
    validNullableNumber(user.rating, 5) &&
    (user.reviewCount === null || validCount(user.reviewCount)) &&
    validCount(user.totalBookings) &&
    validCount(user.totalGroupClasses);
}

// Protect administrator accounts and prevent removed accounts from being restored.
function availableActions(user) {
  if (
    !validId(user.id) ||
    !["student", "tutor"].includes(user.role)
  ) return [];

  if (user.accountStatus === "active") {
    return ["suspended", "removed"];
  }

  if (user.accountStatus === "suspended") {
    return ["active", "removed"];
  }

  return [];
}

// Share account management across the administrator listing pages.
export default function AdminUserManagement({ mode = "users" }) {
  const isStudentPage = mode === "students";
  const isTutorPage = mode === "tutors";
  const isSpecializedPage = isStudentPage || isTutorPage;

  const title = isStudentPage
    ? "Student Management"
    : isTutorPage
      ? "Tutor Management"
      : "User Management";

  const description = isStudentPage
    ? "Manage student accounts and review their learning activity."
    : isTutorPage
      ? "Manage tutor accounts, profiles and teaching activity."
      : "View accounts and manage student and tutor access.";
  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");

  const requestRef = useRef(null);
  const savingRef = useRef(false);

  // Cancel outdated requests before retrieving the current user list.
  const loadUsers = useCallback(async () => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setUsers([]);
    setError("");
    setTotal(0);
    setTotalPages(0);

    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (search) query.set("search", search);
    if (mode === "users" && role) query.set("role", role);

    if (mode === "tutors" && approvalStatus) {
      query.set("approvalStatus", approvalStatus);
    }
    if (status) query.set("status", status);

    try {
      const response = await fetch(
        "/api/admin/" + mode + "?" + query.toString(),
        {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        }
      );

      const data = await response.json();

      if (controller.signal.aborted) return;

      if (!response.ok || data.success !== true) {
        throw new Error("User listing unavailable.");
      }

      const pagination = data.pagination;
      const records = data[mode];

      if (
        !Array.isArray(records) ||
        !pagination ||
        pagination.page !== page ||
        pagination.limit !== 20 ||
        !Number.isSafeInteger(pagination.total) ||
        pagination.total < 0 ||
        pagination.totalPages !== Math.ceil(pagination.total / 20) ||
        records.length > 20 ||
        new Set(records.map(user => user?.id)).size !== records.length ||
        !records.every(user =>
          user &&
          validId(user.id) &&
          typeof user.fullName === "string" &&
          typeof user.email === "string" &&
          ["student", "tutor", "admin"].includes(user.role) &&
          ["active", "suspended", "removed"].includes(user.accountStatus) &&
          (!status || user.accountStatus === status) &&
          (mode !== "users" || !role || user.role === role) &&
          (mode !== "students" || (
            user.role === "student" &&
            validCount(user.totalBookings) &&
            validCount(user.totalGroupEnrollments)
          )) &&
          (mode !== "tutors" || (
            user.role === "tutor" &&
            validTutorStatistics(user) &&
            (!approvalStatus ||
              (approvalStatus === "no_profile"
                ? !user.hasProfile
                : user.approvalStatus === approvalStatus))
          ))
        )
      ) {
        throw new Error("Invalid user response.");
      }

      if (page > Math.max(1, pagination.totalPages)) {
        setPage(Math.max(1, pagination.totalPages));
        return;
      }

      setUsers(records);
      setTotal(pagination.total);
      setTotalPages(pagination.totalPages);

    } catch {
      if (!controller.signal.aborted) {
        setError("Unable to retrieve user accounts. Please refresh.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, search, role, status, mode, approvalStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadUsers]);

  function resetList() {
    requestRef.current?.abort();
    setLoading(true);
    setUsers([]);
    setNotice("");
  }

  function openDecision(user, nextStatus) {
    if (
      loading ||
      error ||
      savingRef.current ||
      decision ||
      !availableActions(user).includes(nextStatus)
    ) return;

    setReason("");
    setNotice("");
    setDecision({ user, status: nextStatus });
  }

  // Save a confirmed decision without automatically retrying mutations.
  async function submitDecision(event) {
    event.preventDefault();

    if (
      !decision ||
      savingRef.current ||
      !reasons.some(([value]) => value === reason) ||
      !availableActions(decision.user).includes(decision.status)
    ) return;

    savingRef.current = true;
    setSaving(true);

    let outcome;

    try {
      const response = await fetch(
        "/api/admin/users/" +
          encodeURIComponent(decision.user.id) +
          "/status",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: decision.status,
            expectedStatus: decision.user.accountStatus,
            reason,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(35000),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data.success !== true ||
        String(data.account?.userId) !== decision.user.id ||
        data.account?.accountStatus !== decision.status ||
        data.account?.previousStatus !== decision.user.accountStatus
      ) {
        throw new Error("Account change not confirmed.");
      }

      outcome = decision.user.fullName +
        " now has account status: " + decision.status + ".";

    } catch {
      outcome = "Account change not confirmed. Review the refreshed account status before trying again.";
    } finally {
      setDecision(null);
      setReason("");
      await loadUsers();
      setNotice(outcome);
      setSaving(false);
      savingRef.current = false;
    }
  }

  const busy = loading || saving || Boolean(decision);

  return (
    <div className="min-w-0">
      <p className="eyebrow">TuLinkUp Administration</p>

      <h1 className="mt-2 text-3xl font-extrabold text-[#173472]">
        {title}
      </h1>

      <p className="mt-3 text-[#71809a]">
        {description}
      </p>

      <div className="panel mt-6 p-5">
        <form
          className="grid gap-4 lg:grid-cols-3"
          onSubmit={event => {
            event.preventDefault();

            if (searchInput.trim() === search && page === 1) {
              void loadUsers();
              return;
            }

            resetList();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <div>
            <label htmlFor="user-search" className="mb-2 block text-sm font-bold">
              Search users
            </label>

            <div className="flex gap-2">
              <input
                id="user-search"
                className={inputClass}
                placeholder="Name or email"
                maxLength={100}
                value={searchInput}
                disabled={busy}
                onChange={event => setSearchInput(event.target.value)}
              />

              <button disabled={busy} className={buttonClass}>
                Search
              </button>
            </div>
          </div>

          {!isSpecializedPage && (
          <div>
            <label htmlFor="user-role" className="mb-2 block text-sm font-bold">
              Role
            </label>

            <select
              id="user-role"
              className={inputClass}
              value={role}
              disabled={busy}
              onChange={event => {
                if (event.target.value === role) return;
                resetList();
                setPage(1);
                setRole(event.target.value);
              }}
            >
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="tutor">Tutors</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
          )}

          {isTutorPage && (
            <div>
              <label
                htmlFor="tutor-approval-filter"
                className="mb-2 block text-sm font-bold"
              >
                Approval status
              </label>

              <select
                id="tutor-approval-filter"
                className={inputClass}
                value={approvalStatus}
                disabled={busy}
                onChange={event => {
                  if (event.target.value === approvalStatus) return;
                  resetList();
                  setPage(1);
                  setApprovalStatus(event.target.value);
                }}
              >
                <option value="">All approval statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="no_profile">No profile</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="user-status" className="mb-2 block text-sm font-bold">
              Account status
            </label>

            <select
              id="user-status"
              className={inputClass}
              value={status}
              disabled={busy}
              onChange={event => {
                if (event.target.value === status) return;
                resetList();
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading..." : error ? "Unavailable" : total + " matching " + mode}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={loadUsers}
            className={buttonClass}
          >
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      <section aria-busy={loading || saving} className="panel mt-6 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center">Loading user accounts...</p>
        ) : error ? (
          <p className="p-8 text-center">Refresh to retrieve users.</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center">No matching users.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="p-4">User</th>
                  {!isSpecializedPage && (
                    <th scope="col" className="p-4">Role</th>
                  )}
                  <th scope="col" className="p-4">Status</th>
                  {isSpecializedPage && (
                    <>
                      <th scope="col" className="p-4">Bookings</th>
                      <th scope="col" className="p-4">
                        {isStudentPage ? "Group enrollments" : "Group classes"}
                      </th>
                    </>
                  )}

                  {isTutorPage && (
                    <>
                      <th scope="col" className="p-4">Approval</th>
                      <th scope="col" className="p-4">Availability</th>
                      <th scope="col" className="p-4">Hourly rate</th>
                      <th scope="col" className="p-4">Rating</th>
                    </>
                  )}

                  <th scope="col" className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="p-4">
                      <p className="font-bold text-[#173472]">{user.fullName}</p>
                      <p className="break-all text-xs text-slate-500">{user.email}</p>
                    </td>

                    {!isSpecializedPage && (
                      <td className="p-4 capitalize">{user.role}</td>
                    )}

                    <td className="p-4 capitalize">
                      <span className={
                        "rounded-full px-3 py-1 text-xs font-semibold " +
                        (user.accountStatus === "active"
                          ? "bg-green-50 text-green-700"
                          : user.accountStatus === "suspended"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700")
                      }>
                        {user.accountStatus}
                      </span>
                    </td>

                    {isSpecializedPage && (
                      <>
                        <td className="p-4">{user.totalBookings}</td>
                        <td className="p-4">
                          {isStudentPage
                            ? user.totalGroupEnrollments
                            : user.totalGroupClasses}
                        </td>
                      </>
                    )}

                    {isTutorPage && (
                      <>
                        <td className="p-4 capitalize">
                          {user.approvalStatus || "No profile"}
                        </td>

                        <td className="p-4 capitalize">
                          {user.availabilityStatus || "Not available"}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {user.hourlyRate === null
                            ? "Not set"
                            : "CA$" + user.hourlyRate.toFixed(2)}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {user.rating === null
                            ? "Not rated"
                            : user.rating.toFixed(1) + " / 5"}

                          {user.reviewCount !== null && (
                            <p className="text-xs text-slate-500">
                              {user.reviewCount} reviews
                            </p>
                          )}
                        </td>
                      </>
                    )}

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {availableActions(user).map(nextStatus => (
                          <button
                            key={nextStatus}
                            type="button"
                            disabled={busy}
                            onClick={() => openDecision(user, nextStatus)}
                            className={
                              buttonClass +
                              (nextStatus === "active"
                                ? " bg-[#173472] text-white"
                                : " text-red-700")
                            }
                          >
                            {actionLabels[nextStatus]}
                          </button>
                        ))}

                        {availableActions(user).length === 0 && (
                          <span className="text-xs text-slate-500">
                            {user.role === "admin" ? "Protected account" : "Not available"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t p-4">
          <button
            type="button"
            disabled={busy || Boolean(error) || page <= 1}
            onClick={() => {
              resetList();
              setPage(value => value - 1);
            }}
            className={buttonClass}
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            disabled={busy || Boolean(error) || page >= totalPages || page >= 10000}
            onClick={() => {
              resetList();
              setPage(value => value + 1);
            }}
            className={buttonClass}
          >
            Next
          </button>
        </div>
      </section>

      {decision && (
        <section
          aria-labelledby="account-confirmation"
          className="panel mt-6 border-2 border-[#173472] p-6"
        >
          <form onSubmit={submitDecision}>
            <h2 id="account-confirmation" className="text-xl font-bold text-[#173472]">
              Confirm {actionLabels[decision.status]}
            </h2>

            <p className="mt-3">
              Change {decision.user.fullName} from{" "}
              {decision.user.accountStatus} to {decision.status}?
              This decision will be recorded in the administrative audit log.
            </p>

            {decision.status === "removed" && (
              <p className="mt-3 rounded-xl bg-red-50 p-4 text-red-700">
                Removal cannot be reversed through this dashboard.
                Historical records will be retained.
              </p>
            )}

            <label htmlFor="account-reason" className="mb-2 mt-5 block font-bold">
              Administrative reason
            </label>

            <select
              id="account-reason"
              className={inputClass}
              required
              autoFocus
              disabled={saving}
              value={reason}
              onChange={event => setReason(event.target.value)}
            >
              <option value="">Select a reason</option>

              {reasons.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDecision(null);
                  setReason("");
                }}
                className={buttonClass}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !reason}
                className={buttonClass + " bg-[#173472] text-white"}
              >
                {saving ? "Saving..." : "Confirm decision"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
