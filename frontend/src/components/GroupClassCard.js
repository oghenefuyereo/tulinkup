"use client";

import Link from "next/link";

export default function GroupClassCard({ groupClass }) {
  const enrolled = Number(
    groupClass.enrolled_students || 0
  );

  const capacity = Number(
    groupClass.maximum_students || 0
  );

  const remaining = Math.max(0, capacity - enrolled);

  const isFull = remaining === 0;

  const priceCents = Number(groupClass.price_cents);

  const isFree = priceCents === 0;

  const price = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(priceCents / 100);

  const scheduledDate = new Date(
    groupClass.scheduled_at
  );

  return (
    <article className="panel flex h-full flex-col overflow-hidden">
      {/* Class cover */}
      <div className="relative flex h-44 flex-col justify-between bg-gradient-to-br from-[#173472] to-[#4269c5] p-5 text-white">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            Group Live Class
          </span>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#173472]">
            {isFree ? "Free" : `${price} CAD / student`}
          </span>
        </div>

        <div>
          <p className="text-sm text-white/80">
            {groupClass.education_level}
          </p>

          <h2 className="mt-2 text-2xl font-extrabold">
            {groupClass.subject}
          </h2>
        </div>
      </div>

      {/* Class content */}
      <div className="flex flex-1 flex-col space-y-4 p-5">
        <div>
          <h3 className="text-xl font-extrabold text-[#17233d]">
            {groupClass.title}
          </h3>

          <p className="mt-2 text-sm text-[#64748b]">
            With {groupClass.tutor_name || "Tutor"}
          </p>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-[#64748b]">
          {groupClass.description}
        </p>

        {/* Schedule */}
        <div className="space-y-3 rounded-xl bg-[#f7f9fd] p-4 text-sm">
          <div>
            <p className="text-xs font-bold text-[#8190a8]">
              CLASS DATE
            </p>

            <p className="mt-1 font-semibold">
              {scheduledDate.toLocaleDateString("en-CA", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-[#8190a8]">
                START TIME
              </p>

              <p className="mt-1 font-semibold">
                {scheduledDate.toLocaleTimeString("en-CA", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-[#8190a8]">
                DURATION
              </p>

              <p className="mt-1 font-semibold">
                {groupClass.duration_minutes} minutes
              </p>
            </div>
          </div>
        </div>

        {/* Available seats */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-[#17233d]">
              {enrolled}/{capacity} enrolled
            </span>

            <span
              className={
                isFull
                  ? "font-bold text-red-600"
                  : "font-bold text-green-700"
              }
            >
              {isFull
                ? "Class full"
                : `${remaining} ${
                    remaining === 1 ? "seat" : "seats"
                  } left`}
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-[#e5eaf3]"
            role="progressbar"
            aria-label="Class capacity"
            aria-valuemin={0}
            aria-valuemax={capacity || 1}
            aria-valuenow={Math.min(enrolled, capacity)}
          >
            <div
              className="h-full rounded-full bg-[#26469b]"
              style={{
                width: `${
                  capacity > 0
                    ? Math.min(
                        100,
                        (enrolled / capacity) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <p className="text-xs text-[#64748b]">
            Maximum {capacity} students per class.
          </p>
        </div>

        {/* Pricing and action */}
        <div className="mt-auto border-t border-[#edf0f5] pt-4">
          <p className="mb-1 text-xs text-[#64748b]">
            Price per student, per session
          </p>

          <p className="text-2xl font-extrabold text-[#173472]">
            {isFree ? "Free" : `${price} CAD`}
          </p>

          <p className="mt-2 text-xs text-[#64748b]">
            {isFree
              ? "No payment required."
              : "One-time payment for the entire class."}
          </p>

          {!isFree && (
            <p className="mt-2 text-xs text-[#64748b]">
              Paid enrolment is coming soon.
            </p>
          )}

          <Link
            href={`/group-classes/${groupClass.id}`}
            className="mt-4 block w-full rounded-xl bg-[#26469b] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#173472]"
          >
            View Class
          </Link>
        </div>
      </div>
    </article>
  );
}