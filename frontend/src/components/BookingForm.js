
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";

function formatDate(dateString, options) {
  if (!dateString) return "";

  const date = new Date(`${dateString.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-CA", options);
}

function normalizeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => ({
      id: String(slot.id ?? ""),
      date: String(slot.date ?? slot.available_date ?? "").slice(0, 10),
      startTime: String(
        slot.startTime ?? slot.start_time ?? ""
      ).slice(0, 5),
      endTime: String(
        slot.endTime ?? slot.end_time ?? ""
      ).slice(0, 5),
    }))
    .filter(
      (slot) =>
        slot.id &&
        slot.date &&
        slot.startTime &&
        slot.endTime
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime)
    );
}

export function BookingForm({ tutor, slots = [] }) {
  const router = useRouter();

  const normalizedSlots = useMemo(
    () => normalizeSlots(slots),
    [slots]
  );

  const subjects = useMemo(() => {
    if (Array.isArray(tutor.subjects)) {
      return tutor.subjects.map((subject) =>
        typeof subject === "string"
          ? { id: subject, name: subject }
          : subject
      );
    }

    return String(tutor.subject || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: name, name }));
  }, [tutor]);

  const dates = useMemo(
    () => [
      ...new Set(normalizedSlots.map((slot) => slot.date)),
    ],
    [normalizedSlots]
  );

  const [selectedDate, setSelectedDate] = useState(
    dates[0] || ""
  );

  const [slotID, setSlotID] = useState(
    normalizedSlots[0]?.id || ""
  );

  const [subjectID, setSubjectID] = useState(
    subjects[0]?.id || ""
  );

  const [duration, setDuration] = useState("60");
  const [note, setNote] = useState("");

  const [state, setState] = useState({
    loading: false,
    error: "",
    success: false,
  });

  const available = useMemo(
    () =>
      normalizedSlots.filter(
        (slot) => slot.date === selectedDate
      ),
    [normalizedSlots, selectedDate]
  );

  const selectedSlot = normalizedSlots.find(
    (slot) =>
      slot.id === slotID &&
      slot.date === selectedDate
  );

  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

  const total = hourlyRate * (Number(duration) / 60);

  function selectDate(date) {
    setSelectedDate(date);

    const firstSlot = normalizedSlots.find(
      (slot) => slot.date === date
    );

    setSlotID(firstSlot?.id || "");
    setState((previous) => ({
      ...previous,
      error: "",
    }));
  }

  async function submit() {
    if (state.loading) return;

    if (!selectedSlot) {
      setState({
        loading: false,
        error: "Choose an available time.",
        success: false,
      });
      return;
    }

    if (!subjectID) {
      setState({
        loading: false,
        error: "Choose a subject.",
        success: false,
      });
      return;
    }

    const durationMinutes = Number(duration);

    const startMinutes =
      Number(selectedSlot.startTime.split(":")[0]) * 60 +
      Number(selectedSlot.startTime.split(":")[1]);

    const endMinutes =
      Number(selectedSlot.endTime.split(":")[0]) * 60 +
      Number(selectedSlot.endTime.split(":")[1]);

    if (startMinutes + durationMinutes > endMinutes) {
      setState({
        loading: false,
        error:
          "The selected time slot is too short for this session duration.",
        success: false,
      });
      return;
    }

    setState({
      loading: true,
      error: "",
      success: false,
    });

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tutorID: tutor.id,
          slotID: selectedSlot.id,
          subjectID,
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          duration: durationMinutes,
          note: note.trim(),
        }),
      });

      if (response.status === 401) {
        const nextPath = `/tutors/${encodeURIComponent(
          tutor.slug
        )}/book`;

        router.push(
          `/login?next=${encodeURIComponent(nextPath)}`
        );
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Unable to submit your booking request."
        );
      }

      setState({
        loading: false,
        error: "",
        success: true,
      });
    } catch (error) {
      setState({
        loading: false,
        error:
          error.message ||
          "Something went wrong. Please try again.",
        success: false,
      });
    }
  }

  if (state.success) {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7f7ed] text-[#149451]">
          <Icon
            name="check"
            className="h-8 w-8"
          />
        </span>

        <h2 className="mt-5 text-2xl font-extrabold">
          Request sent
        </h2>

        <p className="mx-auto mt-3 max-w-md text-[#68758c]">
          Your session with {tutor.name} is pending approval.
          You can track it from your student dashboard.
        </p>

        <button
          type="button"
          onClick={() => router.push("/dashboard/student")}
          className="btn-primary mt-7"
        >
          View my bookings
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
      <section className="panel p-6 sm:p-8">
        <div>
          <label className="form-label">
            1. Choose a date
          </label>

          {dates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dates.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => selectDate(item)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedDate === item
                      ? "border-[#26469b] bg-[#edf1fa]"
                      : "border-[#e0e5ee]"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase text-[#7c879a]">
                    {formatDate(item, {
                      weekday: "short",
                    })}
                  </span>

                  <span className="mt-1 block font-extrabold">
                    {formatDate(item, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#fff8dc] p-4 text-sm text-[#725b00]">
              This tutor has not published any available
              booking times yet.
            </p>
          )}
        </div>

        <div className="mt-7">
          <label className="form-label">
            2. Select a time
          </label>

          <div className="flex flex-wrap gap-3">
            {available.map((slot) => (
              <button
                type="button"
                key={slot.id}
                onClick={() => setSlotID(slot.id)}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  slotID === slot.id
                    ? "border-[#26469b] bg-[#26469b] text-white"
                    : "border-[#dce2ec] bg-white text-[#32415e]"
                }`}
              >
                {slot.startTime}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="form-label">
              3. Subject
            </span>

            <select
              value={subjectID}
              onChange={(event) =>
                setSubjectID(event.target.value)
              }
              className="form-input bg-white"
            >
              {subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="form-label">
              4. Session duration
            </span>

            <select
              value={duration}
              onChange={(event) =>
                setDuration(event.target.value)
              }
              className="form-input bg-white"
            >
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
        </div>

        <label className="mt-6 block">
          <span className="form-label">
            What would you like help with?{" "}
            <span className="font-normal text-[#8993a5]">
              (optional)
            </span>
          </span>

          <textarea
            value={note}
            maxLength={500}
            onChange={(event) =>
              setNote(event.target.value)
            }
            className="min-h-28 w-full rounded-xl border border-[#dce2ec] bg-[#f9fafc] p-4 text-sm"
            placeholder="Share your learning goal or a topic to prepare..."
          />
        </label>

        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {state.error}
          </p>
        )}
      </section>

      <aside className="panel h-fit p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold">
          Booking summary
        </h2>

        <div className="mt-5 space-y-4 text-sm">
          <Row
            label="Tutor"
            value={tutor.name}
          />

          <Row
            label="Hourly rate"
            value={`$${hourlyRate.toFixed(2)}`}
          />

          <Row
            label="Duration"
            value={`${duration} minutes`}
          />

          <Row
            label="Session estimate"
            value={`$${total.toFixed(2)}`}
            strong
          />
        </div>

        <div className="mt-6 rounded-xl bg-[#fff8dc] p-4 text-xs leading-5 text-[#725b00]">
          This MVP submits a booking request only.
          No payment will be taken.
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={
            state.loading ||
            !selectedSlot ||
            !subjectID
          }
          className="btn-primary mt-5 w-full py-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.loading
            ? "Submitting…"
            : "Submit booking request"}
        </button>
      </aside>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#748096]">
        {label}
      </span>

      <span
        className={
          strong
            ? "text-lg font-extrabold text-[#173472]"
            : "font-bold text-[#26334f]"
        }
      >
        {value}
      </span>
    </div>
  );
}
