# TuLinkUp Administrator Deployment and Security Checklist

## Purpose

This checklist identifies the requirements for safely
deploying the TuLinkUp administrator system.

Completing local development and testing does not
automatically establish production readiness.

## Source Code Preparation

- [ ] Review all pending source code changes.
- [ ] Review administrator documentation.
- [ ] Confirm JavaScript syntax validation.
- [ ] Confirm frontend lint validation.
- [ ] Confirm frontend production build.
- [ ] Confirm Git diff validation.
- [ ] Exclude local environment files from Git.
- [ ] Exclude database credentials and private keys.
- [ ] Review backup files before committing.
- [ ] Commit approved changes to GitHub.

## Supabase Database

- [ ] Confirm the correct production database.
- [ ] Create a secure database backup.
- [ ] Verify required database tables and columns.
- [ ] Verify database constraints and indexes.
- [ ] Verify row-level security policies.
- [ ] Verify restricted backend database permissions.
- [ ] Confirm audit record protections.
- [ ] Confirm administrator account status.
- [ ] Confirm encrypted database connections.
- [ ] Verify database certificate validation.
- [ ] Confirm database recovery procedures.

The application must not use a privileged database
administrator account for routine backend operations.

The restricted backend role still requires application
authorization to enforce individual user access.

## Render Backend

- [ ] Confirm the correct GitHub repository.
- [ ] Confirm the backend root directory.
- [ ] Confirm the supported Node.js version.
- [ ] Confirm dependency installation.
- [ ] Confirm the backend startup command.
- [ ] Configure the restricted database connection.
- [ ] Configure the authentication secret.
- [ ] Configure production environment settings.
- [ ] Configure trusted frontend origins.
- [ ] Verify HTTPS connectivity.
- [ ] Verify backend health checks.
- [ ] Verify administrator API availability.
- [ ] Verify safe error responses.
- [ ] Verify that logs do not expose credentials.

Never publish production environment variable values
in documentation, Git commits, or support messages.

## Vercel Frontend

- [ ] Confirm the correct GitHub repository.
- [ ] Confirm the frontend root directory.
- [ ] Confirm Next.js production build settings.
- [ ] Configure the production backend API address.
- [ ] Configure ADMIN_ALLOWED_ORIGINS.
- [ ] Include only explicitly trusted HTTPS origins.
- [ ] Verify authentication cookie security.
- [ ] Verify administrator route protection.
- [ ] Verify frontend API response validation.
- [ ] Verify administrator navigation.
- [ ] Verify mobile and desktop layouts.
- [ ] Verify production domain configuration.
- [ ] Verify HTTPS connectivity.

Administrator mutation requests must not accept
arbitrary origins or wildcard origin configurations.

## Authentication and Authorization

- [ ] Verify administrator authentication.
- [ ] Verify anonymous access is denied.
- [ ] Verify student administrator access is denied.
- [ ] Verify tutor administrator access is denied.
- [ ] Verify suspended administrator access is denied.
- [ ] Verify forged administrator roles are denied.
- [ ] Verify expired authentication tokens are denied.
- [ ] Verify invalid authentication tokens are denied.
- [ ] Verify protected responses are not cached.
- [ ] Verify administrator credentials are protected.

## Administrator Dashboard

- [ ] Verify dashboard statistics.
- [ ] Verify overview refresh.
- [ ] Verify user management.
- [ ] Verify student management.
- [ ] Verify tutor management.
- [ ] Verify tutor approval management.
- [ ] Verify booking monitoring.
- [ ] Verify group class monitoring.
- [ ] Verify all nine administrator navigation links.
- [ ] Verify the audit history interface.
- [ ] Verify the read-only platform settings interface.
- [ ] Verify search and filtering.
- [ ] Verify pagination.
- [ ] Verify loading and error states.
- [ ] Verify accessible form controls.

## Account Management

Use designated test accounts for administrative
verification. Do not modify real user accounts
solely for testing purposes.

- [ ] Verify student suspension.
- [ ] Verify tutor suspension.
- [ ] Verify suspended account access restrictions.
- [ ] Verify eligible account reactivation.
- [ ] Verify account removal in a test environment.
- [ ] Verify removed accounts cannot be reactivated.
- [ ] Verify administrator accounts are protected.
- [ ] Verify administrative reasons are required.
- [ ] Verify stale status changes are rejected.
- [ ] Verify historical records are preserved.
- [ ] Verify administrative decisions are audited.

Account removal is a status change and is not
equivalent to permanent personal data deletion.

Previously issued authentication tokens may become
usable again after account reactivation.

## Tutor Approval

- [ ] Verify pending tutor approval.
- [ ] Verify tutor rejection.
- [ ] Verify eligible tutor reapproval.
- [ ] Verify unauthorized approval requests are denied.
- [ ] Verify administrative reasons are required.
- [ ] Verify stale approval requests are rejected.
- [ ] Verify tutor eligibility restrictions.
- [ ] Verify administrative decisions are audited.

Tutor approval must follow the platform's approved
verification and safeguarding procedures.

## Audit and Transaction Security

- [ ] Verify administrative audit record creation.
- [ ] Verify protected audit retrieval.
- [ ] Verify audit filtering and pagination.
- [ ] Verify unauthorized audit access is denied.
- [ ] Verify invalid audit filters are rejected.
- [ ] Verify audit records cannot be edited or deleted.
- [ ] Verify confidential audit fields are not exposed.
- [ ] Verify audit timestamps and UTC date filtering.
- [ ] Verify failed transactions are rolled back.
- [ ] Verify uncertain connections are discarded.
- [ ] Verify uncertain commit outcomes are handled.
- [ ] Verify transaction timeout configuration.
- [ ] Verify database connections are released.
- [ ] Verify database errors are not exposed.

Audit records support administrative accountability
but are not an independently tamper-proof system.

## Platform Settings Verification

- [ ] Verify the protected settings endpoint.
- [ ] Verify administrator-only access.
- [ ] Verify exact database-to-browser configuration values.
- [ ] Verify settings response field filtering.
- [ ] Verify no-store response caching.
- [ ] Verify unsupported mutation methods are rejected.
- [ ] Verify settings remain read-only in the browser.
- [ ] Verify accessible configuration sections.
- [ ] Verify refresh and error recovery.
- [ ] Verify CAD pricing and group capacity rules.
- [ ] Verify the 20% platform and 80% tutor revenue split.
- [ ] Confirm free tutoring availability.
- [ ] Confirm paid tutoring remains disabled.
- [ ] Confirm tutor transfers remain disabled.

Local settings integration completed with 31 successful
assertions. Production verification is still required.

## Payment Safety

- [ ] Keep paid tutoring disabled until verified.
- [ ] Verify Stripe test-mode integration.
- [ ] Verify webhook signature validation.
- [ ] Verify duplicate payment protection.
- [ ] Verify payment reconciliation.
- [ ] Verify failed payment handling.
- [ ] Verify cancellation and refund procedures.
- [ ] Verify tutor earnings calculations.
- [ ] Verify platform commission calculations.
- [ ] Complete production payment verification.

Administrator booking and group class monitoring
does not provide payment refund or cancellation controls.

## Classroom Safety

- [ ] Verify authorized classroom access.
- [ ] Verify tutor eligibility restrictions.
- [ ] Verify suspended account restrictions.
- [ ] Verify classroom token expiration.
- [ ] Review external classroom token revocation.
- [ ] Verify classroom provider configuration.

Existing external classroom tokens may remain
valid until expiration.

## Privacy and Operational Security

- [ ] Review administrator access permissions.
- [ ] Review personal information exposure.
- [ ] Review privacy and retention requirements.
- [ ] Establish administrator operating procedures.
- [ ] Establish incident reporting procedures.
- [ ] Establish account recovery procedures.
- [ ] Establish credential rotation procedures.
- [ ] Establish database backup schedules.
- [ ] Establish monitoring and alerting procedures.
- [ ] Establish tutor safeguarding procedures.

## Deployment Verification

- [ ] Deploy approved backend changes.
- [ ] Verify backend health.
- [ ] Deploy approved frontend changes.
- [ ] Verify frontend connectivity.
- [ ] Verify administrator authentication.
- [ ] Verify read-only administrator functionality.
- [ ] Verify production audit history retrieval.
- [ ] Verify production settings retrieval.
- [ ] Verify reproducible database schema migrations.
- [ ] Verify database network failure recovery.
- [ ] Verify production performance and operational monitoring.
- [ ] Verify student and tutor functionality.
- [ ] Review application logs.
- [ ] Verify no confidential information is exposed.
- [ ] Record the deployed Git commit identifiers.

## Rollback Preparation

- [ ] Identify the previous stable backend deployment.
- [ ] Identify the previous stable frontend deployment.
- [ ] Verify database backup availability.
- [ ] Review database compatibility before rollback.
- [ ] Document rollback responsibilities.
- [ ] Document recovery verification procedures.

Do not automatically restore a database backup
without evaluating potential data loss.

## Deferred Functionality

The following functionality is outside the current
administrator interface scope:

- Administrator audit record editing or deletion
- Platform settings modification and payment activation
- Administrator booking cancellation
- Administrator payment refunds
- Administrator classroom termination
- Immediate revocation of existing classroom tokens

## Production Approval

Production deployment requires explicit approval
after the relevant checklist items are verified.

Do not mark an item as complete without evidence.

The completion of this document does not authorize
production deployment or activation of paid tutoring.

