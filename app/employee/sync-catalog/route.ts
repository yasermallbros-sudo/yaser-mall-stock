import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncExistingCatalogFromYaser } from "@/lib/catalog-sync";
import { syncCatalogToDatabase } from "@/lib/catalog-db";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const returnTo = String(formData.get("returnTo") || "/employee");
  const requestedMax = String(formData.get("maxProducts") || "");
  const rawMaxProducts = Number(requestedMax || process.env.LIVE_SYNC_MAX_PRODUCTS || 0);
  const maxProducts = rawMaxProducts <= 0 ? 0 : Math.max(1, rawMaxProducts);
  const result = await syncExistingCatalogFromYaser({ maxProducts });
  const mode = "full";
  const database = await syncCatalogToDatabase({ mode });
  revalidatePath("/employee");
  revalidatePath("/admin/items");
  revalidatePath("/dashboard");
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, ...result, database });
  }
  const safeReturnTo = returnTo.startsWith("/employee") ? returnTo : "/employee";
  return NextResponse.redirect(new URL(safeReturnTo, request.url), { status: 303 });
}
