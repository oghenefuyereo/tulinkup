"use strict";

// Build parameterized booking/enrollment payment updates.
// This module does not execute SQL.

const {
  getSourceConfirmation,
} = require("./paymentWebhookSourceStatusService");

function validateSourceId(value) {
  const id = String(value ?? "");

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error("Invalid payment source ID.");
  }

  return id;
}

function buildWebhookSourceUpdate(
  paymentType,
  sourceId,
  paymentStatus
) {
  const id = validateSourceId(sourceId);

  if (
    !["paid", "failed", "expired", "processing"].includes(
      paymentStatus
    )
  ) {
    throw new Error("Unsupported webhook payment status.");
  }

  const confirmation = getSourceConfirmation(
    paymentType,
    paymentStatus
  );

  if (paymentType === "one_on_one") {
    return {
      text: `
        UPDATE public.bookings
        SET payment_status = $1
        WHERE id = $2
          AND status = 'pending'
          AND payment_status = 'pending'
          AND (
            $1 <> 'paid'
            OR (
              (booking_date + booking_time)
              AT TIME ZONE 'America/Toronto'
            ) > clock_timestamp()
          )
        RETURNING id, payment_status, status
      `,
      values: [
        confirmation.paymentStatus,
        id,
      ],
    };
  }

  if (paymentType === "group") {
    return {
      text: `
        UPDATE public.group_class_enrollments
        SET payment_status = $1,
            enrollment_status = CASE
              WHEN $2 = 'confirmed'
              THEN 'confirmed'
              ELSE enrollment_status
            END,
            updated_at = NOW()
        WHERE id = $3
          AND enrollment_status = 'pending'
          AND payment_status = 'pending'
          AND (
            $1 <> 'paid'
            OR EXISTS (
              SELECT 1
              FROM public.group_classes c
              WHERE c.id = group_class_enrollments.class_id
                AND c.status = 'published'
                AND c.scheduled_at > clock_timestamp()
            )
          )
        RETURNING id, payment_status, enrollment_status
      `,
      values: [
        confirmation.paymentStatus,
        confirmation.enrollmentStatus,
        id,
      ],
    };
  }

  throw new Error("Unsupported payment type.");
}

module.exports = {
  buildWebhookSourceUpdate,
};
