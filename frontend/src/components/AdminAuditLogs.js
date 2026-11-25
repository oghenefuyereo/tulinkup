"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  validateAuditQuery,
  validateAdminAuditResponse,
} from "@/lib/adminAuditResponse";

const emptyFilters = {
  adminId: "",
  targetId: "",
  action: "",
  targetType: "",
  startDate: "",
  endDate: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm";

const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

const moneyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

function formatLabel(value) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, character => character.toUpperCase());
}

// Display stored values in a readable format.
function formatValue(key, value) {
  if (value === null) return "Not recorded";

  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  if (key.endsWith("_cents")) {
    return moneyFormatter.format(value / 100);
  }

  if (key.endsWith("_percent")) {
    return value + "%";
  }

  return typeof value === "string"
    ? formatLabel(value)
    : String(value);
}

function FilterField({
  name,
  label,
  value,
  onChange,
  options,
  type = "text",
}) {
  const id = "audit-" + name;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold"
      >
        {label}
      </label>

      {options ? (
        <select
          id={id}
          className={inputClass}
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">All</option>

          {options.map(option => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          className={inputClass}
          value={value}
          maxLength={type === "text" ? 19 : undefined}
          inputMode={type === "text" ? "numeric" : undefined}
          onChange={event => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

// Show only fields that changed during an administrative action.
function AuditChanges({ record }) {
  // Confidential report access is audited without changing status.
  if (record.action === "MESSAGE_REPORT_VIEWED") {
    return (
      <div className="min-w-56 space-y-2">
        <p className="text-xs font-bold text-slate-600">
          Confidential report viewed
        </p>

        <p className="text-sm font-semibold text-[#173472]">
          Status: {formatValue("status", record.newValues.status)}
        </p>

        <p className="text-xs text-slate-500">
          Status unchanged
        </p>

        <p className="text-xs text-slate-500">
          Confidential access recorded.
        </p>
      </div>
    );
  }

  const changedFields = Object.keys(record.previousValues)
    .filter(key =>
      record.previousValues[key] !== record.newValues[key]
    );

  return (
    <div className="min-w-56 space-y-3">
      {changedFields.map(key => (
        <div key={key}>
          <p className="mb-1 text-xs font-bold text-slate-600">
            {formatLabel(key.replace(/_cents$/, ""))}
          </p>

          <p className="text-xs text-slate-500">
            Previous
          </p>

          <p className="break-words">
            {formatValue(key, record.previousValues[key])}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Updated
          </p>

          <p className="break-words font-semibold text-[#173472]">
            {formatValue(key, record.newValues[key])}
          </p>
        </div>
      ))}
    </div>
  );
}

function buildQuery(filters, page) {
  const query = new URLSearchParams({
    page: String(page),
    limit: "20",
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  return query;
}

export default function AdminAuditLogs() {
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const requestRef = useRef(null);

  // Cancel older requests before retrieving audit records.
  const loadRecords = useCallback(async () => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setRecords([]);
    setTotal(0);
    setTotalPages(0);
    setError("");

    try {
      const query = buildQuery(filters, page);

      validateAuditQuery(query);

      const response = await fetch(
        "/api/admin/audit-logs?" + query.toString(),
        {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(22000),
          ]),
        }
      );

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      if (response.status === 403) {
        throw new Error("Administrator access is required.");
      }

      if (!response.ok) {
        throw new Error("Unable to retrieve audit logs. Please refresh.");
      }

      const data = validateAdminAuditResponse(
        await response.json(),
        query
      );

      if (controller.signal.aborted) return;

      if (page > Math.max(1, data.pagination.totalPages)) {
        setPage(Math.max(1, data.pagination.totalPages));
        return;
      }

      setRecords(data.auditLogs);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (failure) {
      if (!controller.signal.aborted) {
        const messages = [
          "Your session has expired. Please sign in again.",
          "Administrator access is required.",
        ];

        setError(
          messages.includes(failure.message)
            ? failure.message
            : "Unable to retrieve audit logs. Please refresh."
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadRecords]);

  function updateDraft(key, value) {
    setFilterError("");

    setDraft(previous => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetRecords() {
    requestRef.current?.abort();
    setRecords([]);
    setTotal(0);
    setTotalPages(0);
    setLoading(true);
    setError("");
  }

  function applyFilters(event) {
    event.preventDefault();

    const nextFilters = {
      ...draft,
      adminId: draft.adminId.trim(),
      targetId: draft.targetId.trim(),
    };

    try {
      validateAuditQuery(buildQuery(nextFilters, 1));
    } catch {
      setFilterError(
        "Check the identifiers, date range and action-target combination."
      );
      return;
    }

    setFilterError("");
    resetRecords();
    setPage(1);
    setFilters(nextFilters);
  }

  function clearFilters() {
    resetRecords();
    setFilterError("");
    setDraft({ ...emptyFilters });
    setFilters({ ...emptyFilters });
    setPage(1);
  }

  function changePage(nextPage) {
    if (
      loading ||
      error ||
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage > 10000
    ) return;

    resetRecords();
    setPage(nextPage);
  }

  return (
    <div className="min-w-0">
      <p className="eyebrow">
        TuLinkUp Administration
      </p>

      <h1 className="mt-2 text-3xl font-extrabold text-[#173472]">
        Administrator Audit Logs
      </h1>

      <p className="mt-3 text-[#71809a]">
        Review administrative decisions and platform configuration changes.
      </p>

      <p className="mt-2 text-sm text-slate-500">
        Read-only history. Dates and timestamps are displayed in UTC.
      </p>

      <div className="panel mt-6 p-5">
        <form onSubmit={applyFilters}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FilterField
              name="adminId"
              label="Administrator ID"
              value={draft.adminId}
              onChange={value => updateDraft("adminId", value)}
            />

            <FilterField
              name="targetId"
              label="Target ID"
              value={draft.targetId}
              onChange={value => updateDraft("targetId", value)}
            />

            <FilterField
              name="action"
              label="Administrative action"
              value={draft.action}
              options={Object.keys(AUDIT_ACTIONS)}
              onChange={value => updateDraft("action", value)}
            />

            <FilterField
              name="targetType"
              label="Target type"
              value={draft.targetType}
              options={AUDIT_TARGETS}
              onChange={value => updateDraft("targetType", value)}
            />

            <FilterField
              name="startDate"
              label="Start date (UTC)"
              type="date"
              value={draft.startDate}
              onChange={value => updateDraft("startDate", value)}
            />

            <FilterField
              name="endDate"
              label="End date (UTC)"
              type="date"
              value={draft.endDate}
              onChange={value => updateDraft("endDate", value)}
            />
          </div>

          {filterError && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {filterError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-[#173472] px-5 py-3 text-sm font-bold text-white"
            >
              Apply filters
            </button>

            <button
              type="button"
              className={buttonClass}
              onClick={clearFilters}
            >
              Clear filters
            </button>

            <button
              type="button"
              className={buttonClass}
              disabled={loading}
              onClick={loadRecords}
            >
              Refresh
            </button>
          </div>
        </form>

        <p aria-live="polite" className="mt-5 text-sm text-slate-600">
          {loading
            ? "Loading..."
            : error
              ? "Unavailable"
              : total + " matching records"}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      <section
        aria-label="Audit history"
        aria-busy={loading}
        className="panel mt-6 overflow-hidden"
      >
        {loading ? (
          <p className="p-8 text-center">
            Loading audit records...
          </p>
        ) : error ? (
          <p className="p-8 text-center">
            Refresh to retrieve audit records.
          </p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center">
            No matching audit records.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Action",
                    "Administrator",
                    "Target",
                    "Changes",
                    "Reason",
                    "Timestamp (UTC)",
                  ].map(label => (
                    <th key={label} scope="col" className="p-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {records.map(record => (
                  <tr
                    key={record.id}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="p-4">
                      <p className="font-bold text-[#173472]">
                        {formatLabel(record.action)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Audit ID: {record.id}
                      </p>

                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-semibold">
                          Request details
                        </summary>

                        <p className="mt-2 break-all">
                          Request ID: {record.requestId}
                        </p>

                        <p className="mt-1">
                          Source: {record.metadata.source
                            ? formatLabel(record.metadata.source)
                            : "Not recorded"}
                        </p>
                      </details>
                    </td>

                    <td className="p-4">
                      ID: {record.adminId}
                    </td>

                    <td className="p-4">
                      <p>{formatLabel(record.targetType)}</p>
                      <p className="text-xs text-slate-500">
                        ID: {record.targetId}
                      </p>
                    </td>

                    <td className="p-4">
                      <AuditChanges record={record} />
                    </td>

                    <td className="p-4">
                      {record.reason
                        ? formatLabel(record.reason)
                        : "Not recorded"}
                    </td>

                    <td className="whitespace-nowrap p-4">
                      <time dateTime={record.createdAt}>
                        {dateFormatter.format(
                          new Date(record.createdAt)
                        )}
                      </time>
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
            className={buttonClass}
            disabled={loading || Boolean(error) || page <= 1}
            onClick={() => changePage(page - 1)}
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            className={buttonClass}
            disabled={
              loading ||
              Boolean(error) ||
              page >= totalPages ||
              page >= 10000
            }
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
