# TuLinkUp Administrator User Guide

## Introduction

The TuLinkUp administrator dashboard helps authorized
administrators manage platform users, review tutors,
and monitor tutoring activities.

Administrator access is restricted to authorized
accounts with an active administrator status.

## Signing In

1. Open the TuLinkUp application.
2. Navigate to the login page.
3. Enter your administrator credentials.
4. Sign in.
5. Open the administrator dashboard.

Never share administrator credentials with other users.

## Dashboard Overview

The overview displays platform statistics, including:

- Total registered users
- Students and tutors
- Administrators
- Active, suspended, and removed accounts
- Pending, approved, and rejected tutor profiles
- One-on-one bookings
- Group classes and enrollments
- Live classroom sessions

Use the refresh control to retrieve updated statistics.

These statistics include historical records where applicable.
They should not be interpreted as real-time online user counts.

## Managing Users

Open the Users section to view registered accounts.

Administrators can:

- Search for users
- Filter users by role
- Filter users by account status
- Navigate between pages
- Review account information
- Manage eligible student and tutor accounts

Administrator accounts cannot be managed through the
ordinary student and tutor account status controls.

## Managing Students

Open the Students section to review student accounts.

Available information includes account details,
account status, booking counts, and group class
enrollment counts.

Administrators can manage eligible student account
statuses when necessary.

## Managing Tutors

Open the Tutors section to review tutor accounts.

Available information includes account details,
profile availability, approval status, hourly rate,
ratings, and tutoring activity counts where available.

Administrators should review account and profile
information before making administrative decisions.

## Reviewing Tutor Profiles

Open the Tutor Approvals section.

To approve a tutor:

1. Locate the tutor profile.
2. Review the available information.
3. Complete the required verification process.
4. Select Approve.
5. Select an appropriate administrative reason.
6. Confirm the decision.
7. Verify the updated approval status.

To reject a tutor:

1. Locate the tutor profile.
2. Review the relevant information.
3. Select Reject.
4. Select an appropriate administrative reason.
5. Confirm the decision.
6. Verify the updated approval status.

Tutor approval does not independently establish
that a background check has been completed.

Administrators must follow the platform's approved
verification and safeguarding procedures.

## Suspending an Account

Suspension temporarily restricts account access.

1. Locate the student or tutor account.
2. Review the account information.
3. Select the suspension action.
4. Select an appropriate administrative reason.
5. Confirm the decision.
6. Verify that the account status is Suspended.

Suspended accounts cannot access protected
backend endpoints requiring an active account.

Previously issued external classroom access tokens
may remain valid until they expire.

## Reactivating an Account

Reactivation restores an eligible suspended account.

1. Locate the suspended account.
2. Review the reason for the original suspension.
3. Confirm that reactivation is appropriate.
4. Select the reactivation action.
5. Select an administrative reason.
6. Confirm the decision.
7. Verify that the account status is Active.

Previously issued, unexpired authentication tokens
may become usable again after reactivation.

## Removing an Account

Account removal is a terminal administrative status.

1. Locate the eligible student or tutor account.
2. Review the account and relevant circumstances.
3. Select the removal action.
4. Select an administrative reason.
5. Confirm the decision.
6. Verify that the account status is Removed.

Removed accounts cannot be restored through the
ordinary administrator account management interface.

Removal preserves historical records rather than
physically deleting the account from the database.

Account removal must not be treated as a completed
personal data deletion request.

## Monitoring Bookings

Open the Bookings section to review one-on-one
tutoring activity.

Administrators can review:

- Student and tutor names
- Subject
- Booking date and time
- Session duration
- Booking status
- Available payment information
- Classroom status

Use search, filters, pagination, and refresh
to locate relevant records.

This section is read-only.

## Monitoring Group Classes

Open the Group Classes section to review group
tutoring activity.

Administrators can review:

- Class title and subject
- Tutor information
- Education level
- Scheduled date and time
- Class duration
- Class price
- Student capacity
- Enrollment counts
- Class and classroom statuses

Use search, filters, pagination, and refresh
to locate relevant records.

This section is read-only.

## Administrative Reasons

Administrative decisions require an appropriate reason.

Reasons support accountability and help explain
why an account or tutor profile was changed.

Select a reason that accurately reflects the
circumstances of the decision.

Do not use administrative actions for personal,
discriminatory, or unauthorized purposes.

## Audit Records

Account status changes and tutor approval decisions
are recorded in the administrative audit system.

To review administrative activity:

1. Open Audit logs from the administrator navigation.
2. Review the recorded actions and affected accounts or profiles.
3. Use administrator ID, action, target type, target ID,
   or UTC date filters to narrow the results.
4. Select Apply filters.
5. Use the pagination controls to review additional records.
6. Select Clear filters to remove the applied filters.
7. Use Refresh to retrieve current audit records.

Audit records include the administrator identifier, action,
target, changed values, reason, and timestamp. Additional
request details may also be available.

Audit records are read-only. Administrators cannot edit
or delete them through the dashboard.

## Platform Settings

Open Settings from the administrator navigation to review
the current platform configuration.

The page displays:

- Private tutoring prices and session capacity.
- Group tutoring prices, capacity, and revenue limits.
- TuLinkUp commission and tutor revenue shares.
- Free tutoring, paid tutoring, and tutor transfer availability.
- Group class capacity rules.

The tested configuration uses Canadian dollars, a maximum
private hourly rate of CAD 25, a maximum group price of
CAD 10 per student, and a maximum gross class revenue
of CAD 100.

TuLinkUp receives 20% and tutors receive 80% before
applicable processing fees and taxes.

Free tutoring is enabled in the tested configuration.
Paid tutoring and tutor transfers remain disabled.

Use Refresh to retrieve current settings.

This page is read-only. Administrators cannot change prices,
commission percentages, or payment availability through it.

Contact the technical team through an approved channel
when configuration changes are required.

## Handling Errors

If an administrative action fails:

1. Read the displayed error message.
2. Refresh the relevant records.
3. Verify the current account or profile status.
4. Confirm whether the original action succeeded.
5. Retry only when appropriate.

Do not repeatedly submit an administrative action
when its previous outcome is uncertain.

If the problem continues, contact the technical
support team through an approved support channel.

## Administrator Responsibilities

Administrators should:

- Protect account credentials.
- Respect student and tutor privacy.
- Review information before making decisions.
- Use accurate administrative reasons.
- Avoid unnecessary account restrictions.
- Report suspected security incidents.
- Follow platform policies and safeguarding procedures.
- Sign out when administrative work is complete.

## Current Limitations

The current administrator interface does not provide:

- Editing or deleting administrative audit records
- Editing platform settings or activating payment services
- Administrator booking cancellation
- Administrator payment refunds
- Administrator classroom termination
- Automated revocation of existing classroom tokens

Payment operations and public deployment require
additional verification before production use.

