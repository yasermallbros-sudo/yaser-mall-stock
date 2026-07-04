"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncState = { type: "idle" | "success" | "error"; message?: string };

export function LiveSyncButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SyncState>({ type: "idle" });

  function sync() {
    setState({ type: "idle" });
    startTransition(async () => {
      try {
        const response = await fetch("/api/sync-live", { method: "POST" });
        const result = await response.json();
        if (!response.ok || result.warning) {
          setState({ type: "error", message: result.warning ?? "Sync failed" });
          return;
        }
        setState({ type: "success", message: "Saved " + result.saved + " live items. Refreshing list..." });
        window.location.reload();
      } catch (error) {
        setState({ type: "error", message: error instanceof Error ? error.message : "Sync failed" });
      }
    });
  }

  return <div className="space-y-2">
    <Button type="button" variant="secondary" onClick={sync} disabled={pending}>
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> {pending ? "Syncing..." : "Sync live items"}
    </Button>
    {state.message ? <p className={state.type === "error" ? "max-w-sm text-sm text-destructive" : "max-w-sm text-sm text-primary"}>{state.message}</p> : null}
  </div>;
}
