import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncExistingCatalogFromYaser } from "@/lib/catalog-sync";
import { shouldRunFullCatalogRefresh, syncCatalogToDatabase } from "@/lib/catalog-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.nextUrl.searchParams.get("secret") === secret || request.headers.get("x-cron-secret") === secret;
}

async function runNightlySync(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const maxProducts = Math.max(1, Number(process.env.LIVE_SYNC_MAX_PRODUCTS || 1200));
  const result = await syncExistingCatalogFromYaser({ maxProducts });
  const mode = await shouldRunFullCatalogRefresh() ? "full" : "newOnly";
  const database = await syncCatalogToDatabase({ mode });
  revalidatePath("/employee");
  revalidatePath("/admin/items");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, mode: "nightly", ...result, database });
}

export async function GET(request: NextRequest) {
  return runNightlySync(request);
}

export async function POST(request: NextRequest) {
  return runNightlySync(request);
}
