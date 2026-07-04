import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncExistingCatalogFromYaser } from "@/lib/catalog-sync";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const returnTo = String(formData.get("returnTo") || "/employee");
  await syncExistingCatalogFromYaser({ maxProducts: Number(process.env.LIVE_SYNC_MAX_PRODUCTS ?? 1200) });
  revalidatePath("/employee");
  revalidatePath("/admin/items");
  revalidatePath("/dashboard");
  const safeReturnTo = returnTo.startsWith("/employee") ? returnTo : "/employee";
  return NextResponse.redirect(new URL(safeReturnTo, request.url), { status: 303 });
}
