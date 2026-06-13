"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type GoogleSettingsCardProps = {
  integration: {
    googleAccountEmail: string;
    calendarEnabled: boolean;
    tasksEnabled: boolean;
    calendarImportState: string;
    tasksImportState: string;
  } | null;
  errorParam: string | null;
};

function getOAuthErrorMessage(errorParam: string): string {
  switch (errorParam) {
    case "invalid_state":
      return "OAuth state mismatch — please try again.";
    case "missing_code":
      return "No authorization code received from Google.";
    case "no_refresh_token":
      return "Google did not return a refresh token. Sign out and sign back in to fix this.";
    case "token_exchange_failed":
      return "Could not exchange the authorization code. Please try again.";
    default:
      return `Google OAuth error: ${errorParam}`;
  }
}

export function GoogleSettingsCard({ integration, errorParam }: GoogleSettingsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importMessage, setImportMessage] = useState<string | null>(null);

  function handleDisconnect() {
    startTransition(async () => {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      router.refresh();
    });
  }

  function handleImport() {
    setImportMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/integrations/google/retry-import", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.data) {
        setImportMessage(
          `Imported ${data.data.calendarEvents} calendar events and ${data.data.tasks} tasks from Google.`,
        );
      } else {
        setImportMessage("Import failed. Check that Calendar and Tasks APIs are enabled in Google Cloud Console.");
      }
      router.refresh();
    });
  }

  function handleIncrementalSync() {
    setImportMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/jobs/google-incremental-sync", { method: "POST" });
      if (res.ok) {
        setImportMessage("Incremental sync complete.");
      } else {
        setImportMessage("Sync failed.");
      }
      router.refresh();
    });
  }

  const importDone =
    integration?.calendarImportState === "COMPLETED" &&
    integration?.tasksImportState === "COMPLETED";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Google</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Calendar and Tasks</h2>
          <p className="mt-1 text-sm text-muted">One account for auth and sync.</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            integration ? "bg-[#e4f6ec] text-[#166534]" : "bg-[var(--panel-muted)] text-muted"
          }`}
        >
          {integration ? "Connected" : "Not connected"}
        </span>
      </div>

      {errorParam && (
        <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getOAuthErrorMessage(errorParam)}
        </div>
      )}

      {importMessage && (
        <div className="mt-4 rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {importMessage}
        </div>
      )}

      {integration ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[12px] border border-border bg-white px-4 py-3 text-sm">
            <p className="text-xs font-medium text-muted">Account</p>
            <p className="mt-1 font-medium text-foreground">{integration.googleAccountEmail}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[12px] border border-border bg-white px-3 py-3">
              <span className="text-muted">Calendar sync</span>
              <span className={`ml-2 font-medium ${integration.calendarEnabled ? "text-green-700" : "text-muted"}`}>
                {integration.calendarEnabled ? "On" : "Off"}
              </span>
            </div>
            <div className="rounded-[12px] border border-border bg-white px-3 py-3">
              <span className="text-muted">Tasks sync</span>
              <span className={`ml-2 font-medium ${integration.tasksEnabled ? "text-green-700" : "text-muted"}`}>
                {integration.tasksEnabled ? "On" : "Off"}
              </span>
            </div>
          </div>

          {!importDone ? (
            <div className="panel-muted rounded-[12px] p-4 text-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">Initial import</p>
                  <p className="mt-1 text-muted">Pull your existing Google data into TikTo.</p>
                </div>
                <Button variant="primary" size="sm" onClick={handleImport} disabled={isPending}>
                  {isPending ? "Importing..." : "Import from Google"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="panel-muted rounded-[12px] p-4 text-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">Latest changes</p>
                  <p className="mt-1 text-muted">Pull updates made in Google since the last sync.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleIncrementalSync} disabled={isPending}>
                  {isPending ? "Syncing..." : "Sync now"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleDisconnect} disabled={isPending}>
              {isPending ? "Disconnecting..." : "Disconnect Google"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted">Turn on sync for tasks and calendar events.</p>
          <div>
            <a href="/api/integrations/google/connect">
              <Button variant="primary" size="sm" disabled={isPending}>
                Connect Google
              </Button>
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}
