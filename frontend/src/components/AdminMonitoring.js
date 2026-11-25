"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const bookingStatuses = [
  "pending", "accepted", "declined", "cancelled", "completed",
];

const classStatuses = [
  "draft", "published", "live", "completed", "cancelled",
];

const paymentStatuses = [
  "unpaid", "pending", "paid", "failed", "refunded", "not_required",
];

const sessionStatuses = [
  "scheduled", "live", "completed", "cancelled",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm";

const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed";

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function validId(value) {
  return typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDateTime(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value));
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(value + "T00:00:00Z");

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function formatMoney(value) {
  return value === null
    ? "Not recorded"
    : currencyFormatter.format(value / 100);
}

function formatStatus(value) {
  return value === null
    ? "No classroom"
    : value.replaceAll("_", " ");
}

// Validate records before showing them to administrators.
function validRecord(record, isBooking) {
  if (
    !record ||
    !validId(record.id) ||
    !validId(record.tutorId) ||
    typeof record.tutorName !== "string" ||
    typeof record.subject !== "string" ||
    !validDateTime(record.createdAt) ||
    !(record.sessionStatus === null ||
      sessionStatuses.includes(record.sessionStatus))
  ) return false;

  if (isBooking) {
    return validId(record.studentId) &&
      typeof record.studentName === "string" &&
      validDate(record.date) &&
      typeof record.startTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/.test(record.startTime) &&
      [30, 60, 90].includes(record.durationMinutes) &&
      bookingStatuses.includes(record.status) &&
      (record.totalPriceCents === null ||
        validCount(record.totalPriceCents)) &&
      (record.currency === null || record.currency === "CAD") &&
      (record.paymentStatus === null ||
        paymentStatuses.includes(record.paymentStatus));
  }

  return typeof record.title === "string" &&
    typeof record.educationLevel === "string" &&
    validDateTime(record.scheduledAt) &&
    Number.isInteger(record.durationMinutes) &&
    record.durationMinutes >= 15 &&
    record.durationMinutes <= 180 &&
    classStatuses.includes(record.status) &&
    validCount(record.priceCents) &&
    record.priceCents <= 1000 &&
    record.currency === "CAD" &&
    Number.isInteger(record.minimumStudents) &&
    record.minimumStudents >= 1 &&
    Number.isInteger(record.maximumStudents) &&
    record.maximumStudents >= 2 &&
    record.maximumStudents <= 20 &&
    record.minimumStudents <= record.maximumStudents &&
    record.priceCents * record.maximumStudents <= 10000 &&
    validCount(record.totalEnrollments) &&
    validCount(record.enrolledStudents) &&
    validCount(record.confirmedStudents) &&
    record.confirmedStudents <= record.enrolledStudents &&
    record.enrolledStudents <= record.totalEnrollments;
}

function StatusFilter({ label, value, options, onChange, disabled }) {
  const filterId = "monitoring-" + label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="block text-sm font-bold">
      <label htmlFor={filterId} className="mb-2 block">
        {label}
      </label>
      <select
        id={filterId}
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">All</option>

        {options.map(option => (
          <option key={option} value={option}>
            {option === "no_session"
              ? "No classroom"
              : formatStatus(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusLabel({ value }) {
  return (
    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">
      {formatStatus(value)}
    </span>
  );
}

// Share the monitoring interface across bookings and group classes.
export default function AdminMonitoring({ mode }) {
  const isBooking = mode === "bookings";
  const recordKey = isBooking ? "bookings" : "groupClasses";
  const statuses = isBooking ? bookingStatuses : classStatuses;

  const [records, setRecords] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestRef = useRef(null);

  // Cancel outdated requests when the filters or page change.
  const loadRecords = useCallback(async () => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setRecords([]);
    setError("");
    setTotal(0);
    setTotalPages(0);

    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (sessionStatus) query.set("sessionStatus", sessionStatus);

    if (isBooking && paymentStatus) {
      query.set("paymentStatus", paymentStatus);
    }

    try {
      const response = await fetch(
        "/api/admin/" + mode + "?" + query.toString(),
        {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(22000),
          ]),
        }
      );

      const data = await response.json();

      if (controller.signal.aborted) return;

      if (!response.ok || data?.success !== true) {
        throw new Error("Monitoring unavailable.");
      }

      const rows = data[recordKey];
      const pagination = data.pagination;

      if (
        !pagination ||
        pagination.page !== page ||
        pagination.limit !== 20 ||
        !validCount(pagination.total) ||
        pagination.totalPages !== Math.ceil(pagination.total / 20) ||
        pagination.hasNextPage !== (page < pagination.totalPages) ||
        pagination.hasPreviousPage !== (page > 1) ||
        !Array.isArray(rows) ||
        rows.length !== Math.min(
          20,
          Math.max(0, pagination.total - (page - 1) * 20)
        ) ||
        new Set(rows.map(row => row?.id)).size !== rows.length ||
        !rows.every(row =>
          validRecord(row, isBooking) &&
          (!status || row.status === status) &&
          (!isBooking || !paymentStatus ||
            row.paymentStatus === paymentStatus) &&
          (!sessionStatus ||
            (sessionStatus === "no_session"
              ? row.sessionStatus === null
              : row.sessionStatus === sessionStatus))
        )
      ) {
        throw new Error("Invalid monitoring response.");
      }

      if (page > Math.max(1, pagination.totalPages)) {
        setPage(Math.max(1, pagination.totalPages));
        return;
      }

      setRecords(rows);
      setTotal(pagination.total);
      setTotalPages(pagination.totalPages);
    } catch {
      if (!controller.signal.aborted) {
        setError("Unable to load monitoring information. Please refresh.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [
    mode,
    recordKey,
    isBooking,
    page,
    search,
    status,
    paymentStatus,
    sessionStatus,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadRecords]);

  function resetList() {
    requestRef.current?.abort();
    setRecords([]);
    setLoading(true);
    setError("");
  }

  function changeFilter(value, current, setter) {
    if (value === current) return;

    resetList();
    setPage(1);
    setter(value);
  }

  function submitSearch(event) {
    event.preventDefault();

    const value = searchInput.trim();

    if (value === search && page === 1) {
      void loadRecords();
      return;
    }

    resetList();
    setPage(1);
    setSearch(value);
  }

  return (
    <div className="min-w-0">
      <p className="eyebrow">TuLinkUp Administration</p>

      <h1 className="mt-2 text-3xl font-extrabold text-[#173472]">
        {isBooking ? "Booking Monitoring" : "Group Class Monitoring"}
      </h1>

      <p className="mt-3 text-[#71809a]">
        {isBooking
          ? "Monitor private tutoring bookings and classroom activity."
          : "Monitor group classes, enrollment activity and classroom status."}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        Read-only monitoring. Session times are displayed in Toronto time.
      </p>

      <div className="panel mt-6 p-5">
        <form
          onSubmit={submitSearch}
          className="grid gap-4 lg:grid-cols-2"
        >
          <div>
            <label
              htmlFor="monitoring-search"
              className="mb-2 block text-sm font-bold"
            >
              Search {isBooking ? "bookings" : "classes"}
            </label>

            <div className="flex gap-2">
              <input
                id="monitoring-search"
                className={inputClass}
                maxLength={100}
                value={searchInput}
                disabled={loading}
                placeholder={
                  isBooking
                    ? "ID, subject or participant"
                    : "ID, title, subject or tutor"
                }
                onChange={event => setSearchInput(event.target.value)}
              />

              <button disabled={loading} className={buttonClass}>
                Search
              </button>
            </div>
          </div>

          <StatusFilter
            label={isBooking ? "Booking status" : "Class status"}
            value={status}
            options={statuses}
            disabled={loading}
            onChange={value => changeFilter(value, status, setStatus)}
          />

          {isBooking && (
            <StatusFilter
              label="Payment status"
              value={paymentStatus}
              options={paymentStatuses}
              disabled={loading}
              onChange={value =>
                changeFilter(value, paymentStatus, setPaymentStatus)
              }
            />
          )}

          <StatusFilter
            label="Classroom status"
            value={sessionStatus}
            options={[...sessionStatuses, "no_session"]}
            disabled={loading}
            onChange={value =>
              changeFilter(value, sessionStatus, setSessionStatus)
            }
          />
        </form>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-600">
            {loading
              ? "Loading..."
              : error
                ? "Unavailable"
                : total + " matching records"}
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={loadRecords}
            className={buttonClass}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      <section
        aria-busy={loading}
        className="panel mt-6 overflow-hidden"
      >
        {loading ? (
          <p className="p-8 text-center">Loading monitoring records...</p>
        ) : error ? (
          <p className="p-8 text-center">Refresh to retrieve records.</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center">No matching records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="p-4">
                    {isBooking ? "Booking" : "Class"}
                  </th>

                  {isBooking && (
                    <th scope="col" className="p-4">Student</th>
                  )}

                  <th scope="col" className="p-4">Tutor</th>
                  <th scope="col" className="p-4">Schedule</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4">Price</th>

                  <th scope="col" className="p-4">
                    {isBooking ? "Payment" : "Enrollment"}
                  </th>

                  <th scope="col" className="p-4">Classroom</th>
                </tr>
              </thead>

              <tbody>
                {records.map(record => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="p-4">
                      <p className="font-bold text-[#173472]">
                        {isBooking ? record.subject : record.title}
                      </p>

                      <p className="text-xs text-slate-500">
                        ID: {record.id}
                      </p>

                      {!isBooking && (
                        <p className="text-xs text-slate-500">
                          {record.subject} · {record.educationLevel}
                        </p>
                      )}
                    </td>

                    {isBooking && (
                      <td className="p-4">{record.studentName}</td>
                    )}

                    <td className="p-4">{record.tutorName}</td>

                    <td className="p-4 whitespace-nowrap">
                      {isBooking
                        ? record.date + " " + record.startTime.slice(0, 5)
                        : dateFormatter.format(new Date(record.scheduledAt))}

                      <p className="text-xs text-slate-500">
                        {record.durationMinutes} minutes
                      </p>
                    </td>

                    <td className="p-4">
                      <StatusLabel value={record.status} />
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {formatMoney(
                        isBooking
                          ? record.totalPriceCents
                          : record.priceCents
                      )}

                      {!isBooking && (
                        <p className="text-xs text-slate-500">
                          Per student
                        </p>
                      )}
                    </td>

                    <td className="p-4">
                      {isBooking ? (
                        record.paymentStatus === null
                          ? "Not recorded"
                          : <StatusLabel value={record.paymentStatus} />
                      ) : (
                        <>
                          <p className="whitespace-nowrap font-bold">
                            {record.enrolledStudents} / {record.maximumStudents}
                          </p>

                          <p className="text-xs text-slate-500">
                            {record.confirmedStudents} confirmed
                          </p>

                          <p className="text-xs text-slate-500">
                            {record.totalEnrollments} historical
                          </p>
                        </>
                      )}
                    </td>

                    <td className="p-4">
                      <StatusLabel value={record.sessionStatus} />
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
            disabled={loading || Boolean(error) || page <= 1}
            className={buttonClass}
            onClick={() => {
              resetList();
              setPage(value => value - 1);
            }}
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            disabled={
              loading ||
              Boolean(error) ||
              page >= totalPages ||
              page >= 10000
            }
            className={buttonClass}
            onClick={() => {
              resetList();
              setPage(value => value + 1);
            }}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
