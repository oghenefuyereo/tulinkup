"use strict";

// Call only inside the existing webhook transaction,
// after locking the group class and target enrollment.

async function checkWebhookGroupCapacity({
  client,
  groupClass,
  enrollment
}) {
  if (!client || typeof client.query !== "function") {
    throw new Error("Transaction client is required.");
  }

  if (!groupClass || !enrollment) {
    throw new Error("Group class and enrollment are required.");
  }

  if (String(groupClass.id) !== String(enrollment.class_id)) {
    throw new Error("Enrollment does not belong to this class.");
  }

  const maximum = Number(groupClass.maximum_students);

  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 20) {
    throw new Error("Invalid group class capacity.");
  }

  const result = await client.query(
    `SELECT COUNT(*)::integer AS occupied
     FROM public.group_class_enrollments
     WHERE class_id = $1
       AND enrollment_status IN (
         'pending',
         'confirmed',
         'attended',
         'absent'
       )`,
    [groupClass.id]
  );

  if (!result || !Array.isArray(result.rows) || result.rows.length !== 1) {
    throw new Error("Unable to verify group class capacity.");
  }

  const occupied = Number(result.rows[0].occupied);

  if (!Number.isSafeInteger(occupied) || occupied < 1) {
    throw new Error("Invalid occupied seat count.");
  }

  return {
    eligible: occupied <= maximum,
    occupied,
    maximum,
    reason: occupied <= maximum ? null : "class_over_capacity"
  };
}

module.exports = {
  checkWebhookGroupCapacity
};
