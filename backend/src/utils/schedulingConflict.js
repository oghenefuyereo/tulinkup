
// Set the default time zone for one-on-one bookings.
const BOOKING_TIME_ZONE = "America/Toronto";

// Lock the tutor's schedule during a database transaction.
// This prevents simultaneous requests from creating conflicts.
async function lockTutorSchedule(client, tutorId) {
  await client.query(
    "SELECT pg_advisory_xact_lock($1::bigint)",
    [tutorId]
  );
}

// Check whether a published or live group class overlaps
// with the proposed session.
async function hasGroupClassConflict(
  client,
  tutorId,
  startTime,
  durationMinutes,
  excludedClassId = null
) {
  const result = await client.query(
    `
      SELECT id
      FROM public.group_classes
      WHERE tutor_id = $1
        AND status IN ('published', 'live')
        AND ($4::bigint IS NULL OR id <> $4::bigint)
        AND scheduled_at < (
          $2::timestamptz +
          ($3::integer * INTERVAL '1 minute')
        )
        AND (
          scheduled_at +
          (duration_minutes * INTERVAL '1 minute')
        ) > $2::timestamptz
      LIMIT 1
    `,
    [
      tutorId,
      startTime,
      durationMinutes,
      excludedClassId,
    ]
  );

  return result.rows.length > 0;
}

// Check whether an existing one-on-one booking overlaps
// with the proposed group class.
async function hasBookingConflict(
  client,
  tutorId,
  startTime,
  durationMinutes
) {
  const result = await client.query(
    `
      SELECT id
      FROM public.bookings
      WHERE tutor_id = $1
        AND status IN ('pending', 'accepted')
        AND (
          (booking_date + booking_time)
          AT TIME ZONE $4::text
        ) < (
          $2::timestamptz +
          ($3::integer * INTERVAL '1 minute')
        )
        AND (
          (
            (booking_date + booking_time)
            AT TIME ZONE $4::text
          ) +
          (duration_minutes * INTERVAL '1 minute')
        ) > $2::timestamptz
      LIMIT 1
    `,
    [
      tutorId,
      startTime,
      durationMinutes,
      BOOKING_TIME_ZONE,
    ]
  );

  return result.rows.length > 0;
}

// Convert a one-on-one booking date and time
// into a timezone-aware timestamp.
async function getBookingStartTime(client, date, time) {
  const result = await client.query(
    `
      SELECT (
        ($1::date + $2::time)
        AT TIME ZONE $3::text
      ) AS start_time
    `,
    [date, time, BOOKING_TIME_ZONE]
  );

  return result.rows[0].start_time;
}

// Export the scheduling functions for both controllers.
module.exports = {
  lockTutorSchedule,
  hasGroupClassConflict,
  hasBookingConflict,
  getBookingStartTime,
};
