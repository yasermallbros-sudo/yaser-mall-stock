import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncExistingCatalogFromYaser } from "@/lib/catalog-sync";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const returnTo = String(formData.get("returnTo") || "/employee");
  const requestedMax = String(formData.get("maxProducts") || "");
  const maxProducts = Math.max(1, Number(requestedMax || process.env.LIVE_SYNC_MAX_PRODUCTS || 5000));
  await syncExistingCatalogFromYaser({ maxProducts });
  revalidatePath("/employee");
  revalidatePath("/admin/items");
  revalidatePath("/dashboard");
  const safeReturnTo = returnTo.startsWith("/employee") ? returnTo : "/employee";
  return NextResponse.redirect(new URL(safeReturnTo, request.url), { status: 303 });
}
