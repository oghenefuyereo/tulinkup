"use client";

import { useCallback, useEffect, useState } from "react";
import {
  validateAdminSettingsResponse,
} from "@/lib/adminSettingsResponse";

// Format stored currency amounts for display.
function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-4 last:border-0">
      <dt className="text-sm text-gray-600">
        {label}
      </dt>

      <dd className="text-right text-sm font-semibold text-gray-900">
        {value}
      </dd>
    </div>
  );
}

function SettingsSection({ title, description, children, footer }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {description}
      </p>

      <dl className="mt-4">
        {children}
      </dl>

      {footer}
    </section>
  );
}

// Display service availability without allowing changes.
function ServiceStatus({ enabled }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        enabled
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default function AdminPlatformSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRetrieved, setLastRetrieved] = useState(null);

  // Retrieve and validate the current platform configuration.
  const loadSettings = useCallback(async signal => {
    setLoading(true);
    setError("");
    setSettings(null);
    setLastRetrieved(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal,
      });

      if (response.status === 401) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      if (response.status === 403) {
        throw new Error("Administrator access is required.");
      }

      if (!response.ok) {
        throw new Error("Platform settings are temporarily unavailable.");
      }

      const data = await response.json();
      const validated = validateAdminSettingsResponse(data);

      if (!signal.aborted) {
        setSettings(validated.settings);
        setLastRetrieved(new Date());
      }
    } catch (error) {
      if (!signal.aborted) {
        const message = [
          "Your session has expired. Please sign in again.",
          "Administrator access is required.",
        ].includes(error.message)
          ? error.message
          : "Unable to retrieve platform settings. Please try again.";

        setError(message);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const start = setTimeout(() => {
      loadSettings(controller.signal).finally(() => {
        clearTimeout(timeout);
      });
    }, 0);

    const timeout = setTimeout(() => {
      controller.abort();
      setSettings(null);
      setLastRetrieved(null);
      setError("The settings request timed out. Please try again.");
      setLoading(false);
    }, 22000);

    return () => {
      clearTimeout(start);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [loadSettings, refreshKey]);

  // Request a fresh copy instead of reusing cached settings.
  function refresh() {
    setRefreshKey(value => value + 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Settings
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Review tutoring prices, revenue distribution and service availability.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-900">
          Read-only configuration
        </p>

        <p className="mt-1 text-sm text-blue-800">
          Settings can be reviewed here. Configuration changes
          and payment activation are not available from this dashboard.
        </p>
      </div>

      <div
        role="region"
        aria-live="polite"
        aria-busy={loading}
        aria-label="Platform configuration"
      >
        {loading && (
          <p role="status" className="py-8 text-sm text-gray-500">
            Loading platform settings...
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <p className="text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={refresh}
              className="mt-3 text-sm font-semibold text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && settings && (
          <div className="space-y-6">
            {lastRetrieved && (
              <p className="text-xs text-gray-500">
                Last retrieved:{" "}
                {lastRetrieved.toLocaleString("en-CA")}
              </p>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <SettingsSection
                title="Private tutoring"
                description="One-on-one session pricing and capacity."
              >
                <SettingRow
                  label="Currency"
                  value={settings.currency}
                />

                <SettingRow
                  label="Minimum hourly rate"
                  value={formatMoney(
                    settings.minPrivateHourlyRateCents,
                    settings.currency
                  )}
                />

                <SettingRow
                  label="Maximum hourly rate"
                  value={formatMoney(
                    settings.maxPrivateHourlyRateCents,
                    settings.currency
                  )}
                />

                <SettingRow
                  label="Maximum students per session"
                  value={settings.maxPrivateStudents}
                />
              </SettingsSection>

              <SettingsSection
                title="Group tutoring"
                description="Class pricing, capacity and revenue limits."
              >
                <SettingRow
                  label="Minimum price per student"
                  value={formatMoney(
                    settings.minGroupPriceCents,
                    settings.currency
                  )}
                />

                <SettingRow
                  label="Maximum price per student"
                  value={formatMoney(
                    settings.maxGroupPriceCents,
                    settings.currency
                  )}
                />

                <SettingRow
                  label="Minimum configured class capacity"
                  value={settings.minGroupCapacity}
                />

                <SettingRow
                  label="Maximum class capacity"
                  value={settings.maxGroupStudents}
                />

                <SettingRow
                  label="Maximum gross class revenue"
                  value={formatMoney(
                    settings.maxGroupRevenueCents,
                    settings.currency
                  )}
                />
              </SettingsSection>

              <SettingsSection
                title="Revenue distribution"
                description="Revenue shares before processing fees and taxes."
                footer={
                  <div aria-hidden="true" className="mt-5 flex h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="bg-blue-600"
                      style={{
                        width: `${settings.platformCommissionPercent}%`,
                      }}
                    />

                    <div
                      className="bg-green-600"
                      style={{
                        width: `${settings.tutorRevenuePercent}%`,
                      }}
                    />
                  </div>
                }
              >
                <SettingRow
                  label="TuLinkUp commission"
                  value={`${settings.platformCommissionPercent}%`}
                />

                <SettingRow
                  label="Tutor revenue"
                  value={`${settings.tutorRevenuePercent}%`}
                />

              </SettingsSection>

              <SettingsSection
                title="Service availability"
                description="Current tutoring and payment configuration."
              >
                <SettingRow
                  label="Free tutoring"
                  value={
                    <ServiceStatus
                      enabled={settings.freeTutoringEnabled}
                    />
                  }
                />

                <SettingRow
                  label="Paid tutoring"
                  value={
                    <ServiceStatus
                      enabled={settings.paidTutoringEnabled}
                    />
                  }
                />

                <SettingRow
                  label="Tutor transfers"
                  value={
                    <ServiceStatus
                      enabled={settings.tutorTransfersEnabled}
                    />
                  }
                />
              </SettingsSection>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Group class capacity rules
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Free classes can accommodate up to{" "}
                {settings.maxGroupStudents} students when
                free tutoring is enabled.
              </p>

              <p className="mt-2 text-sm text-gray-600">
                Paid class capacity is limited by both the maximum
                student count and the maximum gross class revenue.
              </p>

              {settings.maxGroupPriceCents > 0 && (
                <p className="mt-3 text-sm font-medium text-gray-900">
                  At the maximum configured student price of{" "}
                  {formatMoney(
                    settings.maxGroupPriceCents,
                    settings.currency
                  )},
                  the calculated capacity limit is{" "}
                  {Math.min(
                    settings.maxGroupStudents,
                    Math.floor(
                      settings.maxGroupRevenueCents /
                      settings.maxGroupPriceCents
                    )
                  )}{" "}
                  students, subject to the minimum capacity
                  and service availability requirements.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
