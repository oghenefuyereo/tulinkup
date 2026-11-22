"use strict";

// Validate webhook payment references without database access.

function normalizeId(value, name) {
  const id = String(value ?? "");

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error("Invalid " + name + ".");
  }

  return id;
}

function verifyWebhookPaymentReferences(payment, source) {
  if (!payment || !source) {
    throw new Error("Payment and source are required.");
  }

  if (payment.livemode !== false) {
    throw new Error("Only sandbox payments are supported.");
  }

  const studentId = normalizeId(
    payment.student_id,
    "payment student ID"
  );

  const tutorId = normalizeId(
    payment.tutor_id,
    "payment tutor ID"
  );

  if (studentId === tutorId) {
    throw new Error("Student and tutor must be different.");
  }

  if (
    normalizeId(source.student_id, "source student ID") !==
    studentId
  ) {
    throw new Error("Payment student does not match source.");
  }

  if (payment.payment_type === "one_on_one") {
    if (payment.enrollment_id != null) {
      throw new Error("Private payment has enrollment reference.");
    }

    if (
      normalizeId(payment.booking_id, "booking ID") !==
      normalizeId(source.id, "source booking ID")
    ) {
      throw new Error("Booking reference mismatch.");
    }

    if (
      normalizeId(source.tutor_id, "booking tutor ID") !==
      tutorId
    ) {
      throw new Error("Booking tutor mismatch.");
    }

    return true;
  }

  if (payment.payment_type === "group") {
    if (payment.booking_id != null) {
      throw new Error("Group payment has booking reference.");
    }

    if (
      normalizeId(payment.enrollment_id, "enrollment ID") !==
      normalizeId(source.id, "source enrollment ID")
    ) {
      throw new Error("Enrollment reference mismatch.");
    }

    if (
      !source.groupClass ||
      normalizeId(
        source.groupClass.id,
        "group class ID"
      ) !== normalizeId(source.class_id, "enrollment class ID")
    ) {
      throw new Error("Group class reference mismatch.");
    }

    if (
      normalizeId(
        source.groupClass.tutor_id,
        "group tutor ID"
      ) !== tutorId
    ) {
      throw new Error("Group tutor mismatch.");
    }

    return true;
  }

  throw new Error("Unsupported payment type.");
}

module.exports = {
  verifyWebhookPaymentReferences,
};
