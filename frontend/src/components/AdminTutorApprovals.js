"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  "rounded-xl px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";

function statusLabel(value) {
  if (!value) return "No profile";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatusBadge({ status }) {
  const colours = {
    active: "bg-green-50 text-green-700",
    approved: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-700",
    suspended: "bg-amber-50 text-amber-700",
    removed: "bg-red-50 text-red-700",
  };

  return (
    <span className={
      "inline-block rounded-full px-3 py-1 text-xs font-semibold " +
      (colours[status] || "bg-slate-100 text-slate-600")
    }>
      {statusLabel(status)}
    </span>
  );
}

export default function AdminTutorApprovals() {
  const [tutors, setTutors] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");

  const requestRef = useRef(null);
  const savingRef = useRef(false);

  // Load tutors using the selected filters.
  const loadTutors = useCallback(async () => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError("");
    setTutors([]);

    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (search) query.set("search", search);
    if (accountStatus) query.set("status", accountStatus);
    if (approvalStatus) {
      query.set("approvalStatus", approvalStatus);
    }

    try {
      const response = await fetch(
        "/api/admin/tutors?" + query.toString(),
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (controller.signal.aborted) return;

      if (!response.ok || data.success !== true) {
        throw new Error(
          response.status === 401
            ? "Your session has expired. Please sign in again."
            : "Unable to retrieve tutors."
        );
      }

      const pagination = data.pagination || data;

      if (
        !Array.isArray(data.tutors) ||
        !Number.isSafeInteger(pagination.totalPages) ||
        pagination.totalPages < 0 ||
        !Number.isSafeInteger(pagination.total) ||
        pagination.total < 0
      ) {
        throw new Error("The tutor response could not be verified.");
      }

      if (page > Math.max(1, pagination.totalPages)) {
        setPage(Math.max(1, pagination.totalPages));
        return;
      }

      setTutors(data.tutors);
      setTotalPages(pagination.totalPages);
      setTotal(pagination.total);

    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "Unable to retrieve tutors.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, search, accountStatus, approvalStatus]);

  useEffect(() => {
    // Load tutors when the selected filters change.
    const timer = setTimeout(() => {
      void loadTutors();
    }, 0);

    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadTutors]);

  function openDecision(tutor, status) {
    if (
      loading ||
      savingRef.current ||
      tutor.accountStatus !== "active" ||
      !tutor.hasProfile ||
      typeof tutor.profileId !== "string" ||
      !/^[1-9]\d{0,18}$/.test(tutor.profileId) ||
      !["pending", "approved", "rejected"].includes(
        tutor.approvalStatus
      ) ||
      tutor.approvalStatus === status
    ) {
      return;
    }

    setNotice("");
    setError("");
    setReason("");
    setDecision({ tutor, status });
  }

  // Submit the confirmed decision and reload the current tutor list.
  async function submitDecision(event) {
    event.preventDefault();

    if (!decision || !reason || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setError("");
    setNotice("");

    let outcome;

    try {
      const response = await fetch(
        "/api/admin/tutors/" +
          encodeURIComponent(decision.tutor.profileId) +
          "/approval",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: decision.status,
            expectedStatus: decision.tutor.approvalStatus,
            reason,
          }),
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data.success !== true ||
        String(data.approval?.profileId) !==
          decision.tutor.profileId ||
        data.approval?.approvalStatus !== decision.status
      ) {
        throw new Error(
          data.error ||
          "The approval outcome could not be confirmed."
        );
      }

      outcome = decision.tutor.fullName +
        " has been " + decision.status + ".";

    } catch (err) {
      outcome = "Approval not confirmed: " +
        (err.message || "Refresh before trying again.");
    } finally {
      setDecision(null);
      setReason("");

      await loadTutors();

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
        Tutor Approvals
      </h1>

      <p className="mt-3 text-[#71809a]">
        Review tutor accounts and manage their eligibility
        to provide tutoring services.
      </p>

      <div className="panel mt-6 p-5">
        <form
          className="grid gap-4 lg:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <div>
            <label
              htmlFor="tutor-search"
              className="mb-2 block text-sm font-bold"
            >
              Search tutors
            </label>

            <div className="flex gap-2">
              <input
                id="tutor-search"
                className={inputClass}
                placeholder="Name or email"
                maxLength={100}
                value={searchInput}
                disabled={busy}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />

              <button
                type="submit"
                disabled={busy}
                className={buttonClass + " bg-[#173472] text-white"}
              >
                Search
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="account-filter"
                className="mb-2 block text-sm font-bold"
              >
                Account status
              </label>

              <select
                id="account-filter"
                className={inputClass}
                value={accountStatus}
                disabled={busy}
                onChange={(event) => {
                  setPage(1);
                  setAccountStatus(event.target.value);
                }}
              >
                <option value="">All accounts</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="removed">Removed</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="approval-filter"
                className="mb-2 block text-sm font-bold"
              >
                Approval status
              </label>

              <select
                id="approval-filter"
                className={inputClass}
                value={approvalStatus}
                disabled={busy}
                onChange={(event) => {
                  setPage(1);
                  setApprovalStatus(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="no_profile">No profile</option>
              </select>
            </div>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading tutors..." : total + " matching tutors"}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={loadTutors}
            className={buttonClass + " border border-slate-200"}
          >
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      <section
        aria-busy={loading || saving}
        className="panel mt-6 overflow-hidden"
      >
        {loading ? (
          <p className="p-8 text-center text-slate-500">
            Loading tutor accounts...
          </p>
        ) : error ? (
          <p className="p-8 text-center text-slate-500">
            Refresh to retrieve the current tutor list.
          </p>
        ) : tutors.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No tutors match your filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="p-4">Tutor</th>
                  <th scope="col" className="p-4">Account</th>
                  <th scope="col" className="p-4">Approval</th>
                  <th scope="col" className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {tutors.map((tutor) => {
                  const eligible =
                    tutor.accountStatus === "active" &&
                    tutor.hasProfile &&
                    Boolean(tutor.profileId) &&
                    ["pending", "approved", "rejected"].includes(
                      tutor.approvalStatus
                    );

                  return (
                    <tr
                      key={tutor.id}
                      className="border-t border-slate-100"
                    >
                      <td className="p-4">
                        <p className="font-bold text-[#173472]">
                          {tutor.fullName}
                        </p>

                        <p className="mt-1 break-all text-xs text-slate-500">
                          {tutor.email}
                        </p>
                      </td>

                      <td className="p-4">
                        <StatusBadge status={tutor.accountStatus} />
                      </td>

                      <td className="p-4">
                        <StatusBadge status={tutor.approvalStatus} />
                      </td>

                      <td className="p-4">
                        {eligible ? (
                          <div className="flex flex-wrap gap-2">
                            {tutor.approvalStatus !== "approved" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  openDecision(tutor, "approved")
                                }
                                className={
                                  buttonClass + " bg-[#173472] text-white"
                                }
                              >
                                Approve
                              </button>
                            )}

                            {tutor.approvalStatus !== "rejected" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  openDecision(tutor, "rejected")
                                }
                                className={
                                  buttonClass + " border border-red-200 text-red-700"
                                }
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Not available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
          <button
            type="button"
            disabled={busy || page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className={buttonClass + " border border-slate-200"}
          >
            Previous
          </button>

          <span className="text-sm text-slate-600">
            Page {page} of {Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            disabled={busy || page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className={buttonClass + " border border-slate-200"}
          >
            Next
          </button>
        </div>
      </section>

      {decision && (
        <section
          aria-labelledby="approval-confirmation"
          className="panel mt-6 border-2 border-[#173472] p-6"
        >
          <form onSubmit={submitDecision}>
            <h2
              id="approval-confirmation"
              className="text-xl font-extrabold text-[#173472]"
            >
              Confirm tutor {decision.status === "approved"
                ? "approval"
                : "rejection"}
            </h2>

            <p className="mt-3 text-sm text-slate-600">
              Change {decision.tutor.fullName} from{" "}
              {decision.tutor.approvalStatus} to{" "}
              {decision.status}?
              This decision will be recorded in the administrative audit log.
            </p>

            <label
              htmlFor="approval-reason"
              className="mb-2 mt-5 block text-sm font-bold"
            >
              Administrative reason
            </label>

            <select
              id="approval-reason"
              className={inputClass}
              required
              autoFocus
              disabled={saving}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="">Select a reason</option>

              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
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
                className={buttonClass + " border border-slate-200"}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !reason}
                className={
                  buttonClass +
                  (decision.status === "approved"
                    ? " bg-[#173472] text-white"
                    : " bg-red-700 text-white")
                }
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
