"use client";
import { useState, useTransition } from "react";
import { Check, ImageOff, Layers, PackageX, Save, Tags, TriangleAlert } from "lucide-react";
import { auditLabels, auditStatuses } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const icons = { IN_STOCK: Check, OUT_OF_STOCK: PackageX, LOW_STOCK: TriangleAlert, WRONG_IMAGE: ImageOff, WRONG_NAME: Tags, WRONG_PRICE: Tags, WRONG_CATEGORY: Layers, DUPLICATE_PRODUCT: Layers };
export function AuditForm({ productId }: { productId: string }) {
  const [status, setStatus] = useState<(typeof auditStatuses)[number]>("IN_STOCK");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  return <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); data.set("status", status); startTransition(async () => { const res = await fetch("/api/audit", { method: "POST", body: data }); setSaved(res.ok); }); }}>
    <input type="hidden" name="productId" value={productId} />
    <div className="grid grid-cols-2 gap-2">{auditStatuses.map((s) => { const Icon = icons[s]; return <Button key={s} type="button" variant={status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}><Icon className="h-4 w-4" />{auditLabels[s]}</Button>; })}</div>
    <Textarea name="notes" placeholder="Notes" />
    <Input name="photo" type="file" accept="image/*" />
    <Button type="submit" disabled={pending} className="w-full"><Save className="h-4 w-4" />{pending ? "Saving" : saved ? "Saved" : "Save"}</Button>
  </form>;
}
