# TuLinkUp Administrator Technical Documentation

## Overview

TuLinkUp is an educational technology product developed
under Inovenatic Group to connect students with tutors.

The administrator system provides authorized platform
administrators with tools to manage accounts, review tutor
profiles, monitor tutoring activities, and retrieve platform
statistics and administrative audit records.

## Technology Stack

- JavaScript (ES6+)
- Next.js and React
- Tailwind CSS
- Node.js and Express.js
- PostgreSQL hosted on Supabase
- JWT authentication
- npm
- Git and GitHub

## System Architecture

The administrator system uses a layered architecture.

Browser
  -> Next.js administrator interface
  -> Next.js server-side requests and API routes
  -> Express authentication middleware
  -> Administrator authorization middleware
  -> Controllers and services
  -> PostgreSQL database

The frontend presents administrator information and validates
supported API responses. The backend remains responsible
for enforcing authentication, authorization, business rules,
and database operations.

## Administrator Features

- Platform statistics and dashboard overview
- User account listing and search
- Student management
- Tutor management
- Tutor profile approval and rejection
- Account suspension and reactivation
- Account removal through a terminal account status
- One-on-one booking monitoring
- Group class monitoring
- Administrative audit record retrieval

Account removal preserves historical records instead of
physically deleting the account.

## Backend API Endpoints

All endpoints use the /api/admin prefix and require
authentication and administrator authorization.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /dashboard | Retrieve platform statistics |
| GET | /users | List user accounts |
| GET | /users/:id | Retrieve an individual account |
| GET | /students | List student accounts |
| GET | /tutors | List tutor accounts |
| GET | /bookings | Monitor one-on-one bookings |
| GET | /group-classes | Monitor group classes |
| GET | /audit-logs | Retrieve administrative audit records |
| PATCH | /users/:userId/status | Change account status |
| PATCH | /tutors/:profileId/approval | Change tutor approval status |

## Frontend Administrator Pages

| Page | Route |
| --- | --- |
| Overview | /dashboard/admin |
| Users | /dashboard/admin/users |
| Students | /dashboard/admin/students |
| Tutors | /dashboard/admin/tutors |
| Tutor approvals | /dashboard/admin/tutor-approvals |
| Bookings | /dashboard/admin/bookings |
| Group classes | /dashboard/admin/group-classes |

## Authentication and Authorization

Administrator endpoints use authentication and role-based
authorization middleware.

The backend verifies the JWT and checks the current account
role and status against the database.

Anonymous users, students, tutors, suspended administrators,
and users presenting an inconsistent administrator role
are denied access to protected administrator endpoints.

Frontend access restrictions provide an additional layer
of protection but do not replace backend authorization.

## Account Management

Supported account statuses:

- Active
- Suspended
- Removed

Administrators can suspend and reactivate eligible student
and tutor accounts.

Removed accounts cannot be restored through the ordinary
administrator account status endpoint.

Account changes require an administrative reason and an
expected previous status.

Requests containing an outdated expected status are rejected.
This check does not provide complete version-based concurrency
protection against intervening changes that restore the
original status.

## Tutor Approval

Supported tutor approval statuses:

- Pending
- Approved
- Rejected

Administrators can approve or reject eligible tutor profiles.

Approval changes require an administrative reason and
verification of the expected previous approval status.

Tutor eligibility also considers the tutor's account status.

## Database Security

The backend uses a restricted PostgreSQL database role
rather than relying on unrestricted database ownership.

Database protections include:

- Restricted database permissions
- Row-level security policies
- Parameterized SQL queries
- Verified TLS connections for the hosted database
- Explicit response field selection
- Input and identifier validation

Application-level authorization remains essential because
the backend database role can access records required by
multiple application users.

## Transaction Management

Administrative account and tutor approval changes use
database transactions.

The transaction service verifies the administrator, performs
the requested operation, and records the corresponding audit
event within the same transaction.

The service checks transaction startup, commit, rollback,
and connection failure conditions.

Connections with uncertain transaction outcomes are discarded
instead of being returned to the reusable connection pool.

Transaction timeout settings include:

- Lock timeout: 5 seconds
- Statement timeout: 15 seconds
- Idle transaction timeout: 30 seconds

Selected administrative read operations use repeatable-read,
read-only transactions for consistent pagination and counts.

## Audit Records

Administrative audit records contain information about
account status and tutor approval decisions.

Recorded information includes:

- Administrator identifier
- Action
- Target type and identifier
- Previous values
- New values
- Administrative reason
- Request identifier
- Metadata
- Creation timestamp

Audit records support accountability and investigation.
They are not a fully tamper-proof external audit system.

## Frontend Security

Administrator frontend protections include:

- Protected administrator pages
- Server-side authentication checks
- Origin validation for administrative mutations
- Explicit API response validation
- Response field filtering
- Confirmation before administrative decisions
- Required administrative reasons
- Loading and error states
- Accessible monitoring filter labels
- Manual data refresh

Public deployments require explicitly configured trusted
HTTPS origins through ADMIN_ALLOWED_ORIGINS.

## Monitoring and Statistics

Administrators can monitor bookings and group classes
using search, status filters, and pagination.

The overview provides counts for:

- Users by role and account status
- Tutor profiles by approval status
- Bookings
- Group classes and enrollments
- Live classroom sessions

Monitoring is read-only. Administrator cancellation,
refund processing, and classroom termination are not
provided by these monitoring interfaces.

## Testing and Verification

Testing includes JavaScript syntax checks, frontend builds,
simulated database failures, API integration tests, and
automated browser interactions.

Recent verified results:

| Test | Successful checks | Failed checks |
| --- | ---: | ---: |
| Administrator API integration, 191B.8 | 81 | 0 |
| Administrator browser integration, 191C.3 | 38 | 0 |
| Monitoring browser regression, 191C.5 | 19 | 0 |
| Transaction fault simulation, 191D.3 | 28 | 0 |
| Final database integration, 191D.4 | 60 | 0 |

The monitoring accessibility issue identified during earlier
browser testing was corrected and successfully retested.

The final database integration test verified administrator
access restrictions, account suspension and reactivation,
tutor approval transitions, five actual audit records,
audit pagination, and database connection health.

Database integration tests used temporary isolated PostgreSQL
databases containing synthetic accounts.

Temporary test databases were removed after successful
verification, and the permanent test database was preserved.

## Known Limitations

- Administrator audit log retrieval is implemented in the
  backend, but its dedicated frontend interface is deferred.
- The administrator settings interface is deferred.
- Stripe payment integration requires additional verification.
- Previously issued JWTs may become usable again after
  account reactivation if they have not expired.
- Previously issued classroom access tokens are not
  automatically revoked by administrator account changes.
- Full student and tutor dashboard browser verification
  remains outstanding.
- Production deployment and large-scale performance
  verification remain outstanding.
- Database fault simulation does not replace real
  infrastructure failure testing.

The completed administrator tests establish functionality
within the tested scope. They do not guarantee that the
entire application is production-ready.

## Maintenance

Future changes to administrator authorization, database
permissions, account status rules, tutor eligibility, or
audit behavior should include regression testing.

Credentials, database passwords, JWT secrets, and private
environment configuration must never be committed to Git.

