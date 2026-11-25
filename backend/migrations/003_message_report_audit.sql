-- Extend administrator audit support for message reports.
-- Preserve existing audit actions and security controls.
-- Execute within a database transaction.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT admin_audit_logs_action_check,
  DROP CONSTRAINT admin_audit_logs_target_type_check,
  DROP CONSTRAINT admin_audit_logs_action_target_check;

ALTER TABLE public.admin_audit_logs

  ADD CONSTRAINT admin_audit_logs_action_check
  CHECK (
    action IN (
      'TUTOR_APPROVED',
      'TUTOR_REJECTED',
      'ACCOUNT_SUSPENDED',
      'ACCOUNT_REACTIVATED',
      'ACCOUNT_REMOVED',
      'PLATFORM_SETTINGS_UPDATED',
      'BOOKING_CANCELLED_BY_ADMIN',
      'GROUP_CLASS_CANCELLED_BY_ADMIN',
      'MESSAGE_REPORT_VIEWED',
      'MESSAGE_REPORT_REVIEW_STARTED',
      'MESSAGE_REPORT_RESOLVED',
      'MESSAGE_REPORT_DISMISSED'
    )
  ),

  ADD CONSTRAINT admin_audit_logs_target_type_check
  CHECK (
    target_type IN (
      'tutor_profile',
      'user',
      'platform_settings',
      'booking',
      'group_class',
      'message_report'
    )
  ),

  ADD CONSTRAINT admin_audit_logs_action_target_check
  CHECK (
    (
      action IN (
        'TUTOR_APPROVED',
        'TUTOR_REJECTED'
      )
      AND target_type = 'tutor_profile'
    )
    OR
    (
      action IN (
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_REACTIVATED',
        'ACCOUNT_REMOVED'
      )
      AND target_type = 'user'
    )
    OR
    (
      action = 'PLATFORM_SETTINGS_UPDATED'
      AND target_type = 'platform_settings'
    )
    OR
    (
      action = 'BOOKING_CANCELLED_BY_ADMIN'
      AND target_type = 'booking'
    )
    OR
    (
      action = 'GROUP_CLASS_CANCELLED_BY_ADMIN'
      AND target_type = 'group_class'
    )
    OR
    (
      action IN (
        'MESSAGE_REPORT_VIEWED',
        'MESSAGE_REPORT_REVIEW_STARTED',
        'MESSAGE_REPORT_RESOLVED',
        'MESSAGE_REPORT_DISMISSED'
      )
      AND target_type = 'message_report'
    )
  );
