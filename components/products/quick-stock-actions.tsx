"use client";

import { useState, useTransition } from "react";
import { Check, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "IN_STOCK" | "OUT_OF_STOCK";

export function QuickStockActions({ productId, initialStatus }: { productId: string; initialStatus?: Status }) {
  const [status, setStatus] = useState<Status | undefined>(initialStatus);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save(nextStatus: Status) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/audit/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, status: nextStatus })
      });
      if (!response.ok) {
        setMessage("Could not save. Try again.");
        return;
      }
      setStatus(nextStatus);
      setMessage(nextStatus === "IN_STOCK" ? "Marked in stock" : "Marked out of stock");
    });
  }

  return <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" disabled={pending} onClick={() => save("IN_STOCK")} variant={status === "IN_STOCK" ? "default" : "outline"} className="h-11">
        <Check className="h-4 w-4" /> In Stock
      </Button>
      <Button type="button" disabled={pending} onClick={() => save("OUT_OF_STOCK")} variant={status === "OUT_OF_STOCK" ? "destructive" : "outline"} className="h-11">
        <PackageX className="h-4 w-4" /> Out Stock
      </Button>
    </div>
    {message ? <p className="text-center text-xs text-muted-foreground">{message}</p> : null}
  </div>;
}
