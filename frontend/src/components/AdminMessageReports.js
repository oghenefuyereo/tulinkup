"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  validateReportStatisticsResponse,
  validateReportListResponse,
  validateReportDetailsResponse,
  validateReportDecisionResponse,
} from "@/lib/adminMessageReportResponse";

const BASE = "/api/admin/message-reports";

const STATUSES = [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
];

const REASONS = [
  "spam",
  "harassment",
  "inappropriate_content",
  "safety_concern",
  "payment_solicitation",
  "other",
];

const DECISION_REASONS = [
  "ADMINISTRATIVE_REVIEW",
  "POLICY_VIOLATION",
  "SAFETY_CONCERN",
  "OTHER_ADMINISTRATIVE_REASON",
];

const EMPTY_FILTERS = {
  search: "",
  status: "",
  reason: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm";

const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";

const primaryClass =
  "rounded-xl bg-[#173472] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";

const statusStyles = {
  pending: "bg-amber-100 text-amber-800",
  reviewing: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-slate-100 text-slate-700",
};

const dateFormatter = new Intl.DateTimeFormat(
  "en-CA",
  {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }
);

function formatLabel(value) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, character =>
      character.toUpperCase()
    );
}

function formatDate(value) {
  return value
    ? dateFormatter.format(new Date(value)) + " UTC"
    : "Not recorded";
}

function StatusBadge({ status }) {
  return (
    <span className={
      "inline-flex rounded-full px-3 py-1 text-xs font-bold " +
      statusStyles[status]
    }>
      {formatLabel(status)}
    </span>
  );
}

function allowedDecisions(status) {
  if (status === "pending") return ["reviewing"];

  if (status === "reviewing") {
    return ["resolved", "dismissed"];
  }

  return [];
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const error = new Error("Message report request failed.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function safeReadError(error) {
  if (error.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (error.status === 403) {
    return "Administrator access is required.";
  }

  if (error.status === 404) {
    return "Message report not found.";
  }

  return "Unable to retrieve message reports. Please try again.";
}

function Statistics({ statistics }) {
  const cards = [
    ["Total reports", "total", "text-[#173472]"],
    ["Pending", "pending", "text-amber-700"],
    ["Reviewing", "reviewing", "text-blue-700"],
    ["Resolved", "resolved", "text-green-700"],
    ["Dismissed", "dismissed", "text-slate-700"],
    ["Open safety concerns", "openSafetyConcerns", "text-red-700"],
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(([label, key, color]) => (
        <div
          key={key}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className={"mt-3 text-3xl font-extrabold " + color}>
            {statistics ? statistics[key] : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AdminMessageReports() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState("");

  const [nextStatus, setNextStatus] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [saving, setSaving] = useState(false);

  const detailRequest = useRef(null);
  const savingRef = useRef(false);

  // Load only non-confidential summaries and statistics.
  useEffect(() => {
    const controller = new AbortController();

    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }

    const options = {
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(22000),
      ]),
    };

    async function loadDashboard() {
      try {
        const [statsData, listData] = await Promise.all([
          requestJSON(BASE + "/statistics", options),
          requestJSON(BASE + "?" + query.toString(), options),
        ]);

        const stats =
          validateReportStatisticsResponse(statsData);

        const list =
          validateReportListResponse(listData, query);

        if (controller.signal.aborted) return;

        setDashboard({
          statistics: stats.statistics,
          reports: list.reports,
          pagination: list.pagination,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setDashboard(null);
        setError(safeReadError(error));
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [filters, page, revision]);

  useEffect(() => {
    return () => detailRequest.current?.abort();
  }, []);

  function clearDetails() {
    detailRequest.current?.abort();
    detailRequest.current = null;

    setSelectedId(null);
    setDetails(null);
    setDetailError("");
    setNextStatus("");
    setDecisionReason("");
  }

  function refresh() {
    clearDetails();
    setDashboard(null);
    setError("");
    setRevision(value => value + 1);
  }

  function applyFilters(event) {
    event.preventDefault();

    if (savingRef.current) return;

    setNotice("");

    if (
      draft.search.includes("\u0000") ||
      Array.from(draft.search).length > 100
    ) {
      setNotice("Search must contain at most 100 characters.");
      return;
    }

    setFilters({
      ...draft,
      search: draft.search.trim(),
    });

    setPage(1);
    refresh();
  }

  function resetFilters() {
    if (savingRef.current) return;

    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setNotice("");
    refresh();
  }

  function changePage(value) {
    if (
      savingRef.current ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 100000
    ) {
      return;
    }

    setPage(value);
    setNotice("");
    refresh();
  }

  // Confidential content is fetched only after an explicit click.
  async function openReport(id) {
    if (savingRef.current) return;

    clearDetails();
    setNotice("");
    setSelectedId(id);

    const controller = new AbortController();

    detailRequest.current = controller;

    try {
      const data = await requestJSON(BASE + "/" + id, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(22000),
        ]),
      });

      const validated =
        validateReportDetailsResponse(data, id);

      if (
        controller.signal.aborted ||
        detailRequest.current !== controller
      ) {
        return;
      }

      setDetails(validated);
    } catch (error) {
      if (
        controller.signal.aborted ||
        detailRequest.current !== controller
      ) {
        return;
      }

      setDetails(null);
      setDetailError(safeReadError(error));
    }
  }

  // Decisions are never retried automatically.
  async function submitDecision(event) {
    event.preventDefault();

    if (
      savingRef.current ||
      !details ||
      !allowedDecisions(details.report.status)
        .includes(nextStatus) ||
      !DECISION_REASONS.includes(decisionReason)
    ) {
      return;
    }

    const id = details.report.id;

    const body = {
      status: nextStatus,
      expectedStatus: details.report.status,
      reason: decisionReason,
    };

    savingRef.current = true;

    setSaving(true);
    setNotice("");
    setDetailError("");

    try {
      const data = await requestJSON(
        BASE + "/" + id + "/status",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(32000),
        }
      );

      const result =
        validateReportDecisionResponse(
          data,
          id,
          body
        );

      setNotice(
        "Report #" + id +
        " updated to " +
        formatLabel(result.decision.status) +
        ". Audit record #" +
        result.decision.auditId +
        "."
      );

      refresh();
    } catch (error) {
      if (error.status === 409) {
        setNotice(
          "The report status has changed. Review the refreshed report before making another decision."
        );
      } else if (
        error.status === 401 ||
        error.status === 403
      ) {
        setNotice(safeReadError(error));
      } else {
        setNotice(
          "The decision outcome could not be confirmed. Verify the current report status before trying again."
        );
      }

      // Clear confidential content and reload summaries.
      refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const pagination = dashboard?.pagination;
  const report = details?.report;

  return (
    <section className="space-y-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            Message Reports
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Monitor, investigate and manage reported messages.
          </p>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={saving}
          onClick={() => {
            setNotice("");
            refresh();
          }}
        >
          Refresh
        </button>
      </div>

      <Statistics statistics={dashboard?.statistics} />

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          {notice}
        </p>
      )}

      <form
        onSubmit={applyFilters}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <fieldset
          disabled={saving}
          className="grid gap-4 md:grid-cols-3"
        >
          <div>
            <label
              htmlFor="report-search"
              className="mb-2 block text-sm font-bold"
            >
              Search reports
            </label>

            <input
              id="report-search"
              className={inputClass}
              placeholder="Report ID, name or email"
              maxLength={100}
              value={draft.search}
              onChange={event => setDraft({
                ...draft,
                search: event.target.value,
              })}
            />
          </div>

          <div>
            <label
              htmlFor="report-status"
              className="mb-2 block text-sm font-bold"
            >
              Status
            </label>

            <select
              id="report-status"
              className={inputClass}
              value={draft.status}
              onChange={event => setDraft({
                ...draft,
                status: event.target.value,
              })}
            >
              <option value="">All statuses</option>

              {STATUSES.map(status => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="report-reason"
              className="mb-2 block text-sm font-bold"
            >
              Report reason
            </label>

            <select
              id="report-reason"
              className={inputClass}
              value={draft.reason}
              onChange={event => setDraft({
                ...draft,
                reason: event.target.value,
              })}
            >
              <option value="">All reasons</option>

              {REASONS.map(reason => (
                <option key={reason} value={reason}>
                  {formatLabel(reason)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 md:col-span-3">
            <button
              type="submit"
              className={primaryClass}
            >
              Apply filters
            </button>

            <button
              type="button"
              className={buttonClass}
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        </fieldset>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {!dashboard && !error && (
        <p
          role="status"
          className="rounded-xl bg-white p-8 text-center"
        >
          Loading message reports...
        </p>
      )}

      {dashboard && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    "Report",
                    "Reporter",
                    "Reported user",
                    "Reason",
                    "Status",
                    "Created",
                    "Action",
                  ].map(label => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap px-4 py-4"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {dashboard.reports.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-bold">
                      #{item.id}
                    </td>

                    <td className="px-4 py-4">
                      <p className="break-words font-semibold">
                        {item.reporter_name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatLabel(item.reporter_role)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="break-words font-semibold">
                        {item.reported_user_name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatLabel(item.reported_user_role)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span className={
                        item.reason === "safety_concern"
                          ? "font-bold text-red-700"
                          : ""
                      }>
                        {formatLabel(item.reason)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={
                          saving ||
                          selectedId === item.id
                        }
                        onClick={() => openReport(item.id)}
                      >
                        View report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {dashboard.reports.length === 0 && (
              <div className="p-12 text-center">
                <p className="font-bold">
                  No message reports found
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Reports matching your filters will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
            <p className="text-sm text-slate-500">
              {pagination.total} reports
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className={buttonClass}
                disabled={
                  saving ||
                  !pagination.hasPreviousPage
                }
                onClick={() => changePage(page - 1)}
              >
                Previous
              </button>

              <span className="text-sm">
                Page {page} of {
                  Math.max(1, pagination.totalPages)
                }
              </span>

              <button
                type="button"
                className={buttonClass}
                disabled={
                  saving ||
                  !pagination.hasNextPage ||
                  page >= 100000
                }
                onClick={() => changePage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedId && (
        <section
          aria-labelledby="selected-report-title"
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="selected-report-title"
              className="text-xl font-extrabold"
            >
              Report #{selectedId}
            </h2>

            <button
              type="button"
              className={buttonClass}
              disabled={saving}
              onClick={clearDetails}
            >
              Close report
            </button>
          </div>

          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Confidential information. Access to reported
            message content is recorded in the administrator
            audit log.
          </p>

          {!details && !detailError && (
            <p role="status">
              Loading confidential report details...
            </p>
          )}

          {detailError && (
            <p role="alert" className="text-sm text-red-700">
              {detailError}
            </p>
          )}

          {report && (
            <>
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-slate-500">Reporter</p>
                  <p className="font-bold">
                    {report.reporter_name}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Reported user</p>
                  <p className="font-bold">
                    {report.reported_user_name}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Reason</p>
                  <p className="font-bold">
                    {formatLabel(report.reason)}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-slate-500">Status</p>
                  <StatusBadge status={report.status} />
                </div>

                <div>
                  <p className="text-slate-500">Reported at</p>
                  <p>{formatDate(report.created_at)}</p>
                </div>

                <div>
                  <p className="text-slate-500">Access audit ID</p>
                  <p>#{details.auditId}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-bold">
                  Reported message
                </h3>

                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(report.message_created_at)}
                </p>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {report.message_body}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-bold">
                  Report description
                </h3>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {report.details || "No description provided."}
                </p>
              </div>

              {allowedDecisions(report.status).length > 0 ? (
                <form
                  onSubmit={submitDecision}
                  className="space-y-4 border-t border-slate-200 pt-5"
                >
                  <h3 className="font-extrabold">
                    Moderation decision
                  </h3>

                  <fieldset
                    disabled={saving}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <div>
                      <label
                        htmlFor="decision-status"
                        className="mb-2 block text-sm font-bold"
                      >
                        New status
                      </label>

                      <select
                        required
                        id="decision-status"
                        className={inputClass}
                        value={nextStatus}
                        onChange={event =>
                          setNextStatus(event.target.value)
                        }
                      >
                        <option value="">
                          Select decision
                        </option>

                        {allowedDecisions(report.status)
                          .map(status => (
                            <option key={status} value={status}>
                              {status === "reviewing"
                                ? "Start review"
                                : status === "resolved"
                                  ? "Resolve report"
                                  : "Dismiss report"}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="decision-reason"
                        className="mb-2 block text-sm font-bold"
                      >
                        Administrative reason
                      </label>

                      <select
                        required
                        id="decision-reason"
                        className={inputClass}
                        value={decisionReason}
                        onChange={event =>
                          setDecisionReason(event.target.value)
                        }
                      >
                        <option value="">Select reason</option>

                        {DECISION_REASONS.map(reason => (
                          <option key={reason} value={reason}>
                            {formatLabel(reason)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </fieldset>

                  <p className="text-xs text-slate-500">
                    Submitting this decision updates the report
                    and creates an administrator audit record.
                  </p>

                  <button
                    type="submit"
                    className={primaryClass}
                    disabled={
                      saving ||
                      !nextStatus ||
                      !decisionReason
                    }
                  >
                    {saving
                      ? "Submitting decision..."
                      : "Confirm decision"}
                  </button>
                </form>
              ) : (
                <p className="rounded-xl bg-slate-100 p-4 text-sm">
                  This report has reached its final status.
                  No further status changes are permitted.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
