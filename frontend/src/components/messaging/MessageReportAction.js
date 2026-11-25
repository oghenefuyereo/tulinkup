"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  MESSAGE_REPORT_REASONS,
  reportMessage,
} from "@/lib/messagingApi";

const MAX_DETAILS_LENGTH = 2000;

export default function MessageReportAction({
  conversationId,
  message,
}) {
  const titleId = useId();
  const reasonId = useId();
  const detailsId = useId();
  const menuId = useId();

  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const pendingRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const detailsLength = Array.from(details).length;

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [menuOpen]);

  function openReport() {
    setMenuOpen(false);
    setError("");

    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }

  function closeReport() {
    if (pendingRef.current) return;

    dialogRef.current?.close();

    setReason("");
    setDetails("");
    setError("");

    triggerRef.current?.focus();
  }

  async function submitReport(event) {
    event.preventDefault();

    if (pendingRef.current || submitted) return;

    if (
      !MESSAGE_REPORT_REASONS.some(
        item => item.value === reason
      )
    ) {
      setError("Please select a reporting reason.");
      return;
    }

    if (detailsLength > MAX_DETAILS_LENGTH) {
      setError(
        "Additional details cannot exceed 2000 characters."
      );
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError("");

    try {
      await reportMessage(
        conversationId,
        message.id,
        { reason, details }
      );

      setSubmitted(true);
      setReason("");
      setDetails("");
    } catch (requestError) {
      setError(
        requestError.message ||
        "Unable to submit your report. Please try again."
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative shrink-0 self-center"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Message options"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen(value => !value)}
        className="grid h-9 w-9 place-items-center rounded-full text-[#68758c] hover:bg-[#e9edf5] hover:text-[#26469b] focus-visible:outline-2 focus-visible:outline-[#26469b]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {menuOpen && (
        <div
          id={menuId}
          className="absolute right-0 bottom-full z-30 mb-1 w-44 rounded-xl border border-[#e3e7ef] bg-white p-1.5 shadow-lg"
        >
          <button
            type="button"
            onClick={openReport}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-[#f7f9fd]"
          >
            {submitted
              ? "Report submitted"
              : "Report message"}
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={event => {
          event.preventDefault();
          closeReport();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-[#e3e7ef] bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"
      >
        {submitted ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-50 text-xl font-bold text-[#25ad61]">
              <span aria-hidden="true">✓</span>
            </div>

            <h2
              id={titleId}
              className="text-lg font-bold text-[#17233d]"
            >
              Report submitted
            </h2>

            <p
              role="status"
              className="mt-3 text-sm leading-6 text-[#68758c]"
            >
              Thank you for reporting this message.
              Your report has been received for review.
              The other participant will not be notified.
            </p>

            <button
              type="button"
              onClick={closeReport}
              className="btn-primary mt-6 w-full"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submitReport}>
            <h2
              id={titleId}
              className="text-lg font-bold text-[#17233d]"
            >
              Report message
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#68758c]">
              Help us keep TuLinkUp a safe and
              respectful learning community.
            </p>

            <div className="mt-4 rounded-xl border border-[#e3e7ef] bg-[#f7f9fd] p-3">
              <p className="mb-1 text-xs font-semibold text-[#68758c]">
                Reported message
              </p>

              <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5 text-[#17233d] [overflow-wrap:anywhere]">
                {message.body}
              </p>
            </div>

            <label
              htmlFor={reasonId}
              className="mt-5 block text-sm font-semibold text-[#17233d]"
            >
              Why are you reporting this message?
            </label>

            <select
              id={reasonId}
              required
              value={reason}
              disabled={pending}
              onChange={event => {
                setReason(event.target.value);
                setError("");
              }}
              className="mt-2 w-full rounded-xl border border-[#e3e7ef] bg-white px-3 py-3 text-sm text-[#17233d] outline-none focus:border-[#26469b]"
            >
              <option value="">
                Select a reason
              </option>

              {MESSAGE_REPORT_REASONS.map(item => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <label
              htmlFor={detailsId}
              className="mt-4 block text-sm font-semibold text-[#17233d]"
            >
              Additional details (optional)
            </label>

            <textarea
              id={detailsId}
              rows={4}
              value={details}
              disabled={pending}
              onChange={event => {
                setDetails(
                  Array.from(event.target.value)
                    .slice(0, MAX_DETAILS_LENGTH)
                    .join("")
                );
              }}
              placeholder="Tell us more about your concern..."
              className="mt-2 w-full resize-y rounded-xl border border-[#e3e7ef] px-3 py-3 text-sm text-[#17233d] outline-none focus:border-[#26469b]"
            />

            <p className="mt-1 text-right text-xs text-[#68758c]">
              {detailsLength}/{MAX_DETAILS_LENGTH}
            </p>

            <div className="mt-4 rounded-xl bg-[#edf1fa] p-3">
              <p className="text-xs leading-5 text-[#173472]">
                Your report is confidential and will
                be available to authorized moderators
                for review. The other participant
                will not be notified.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={closeReport}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={pending || !reason}
                className="btn-primary disabled:opacity-50"
              >
                {pending
                  ? "Submitting..."
                  : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
