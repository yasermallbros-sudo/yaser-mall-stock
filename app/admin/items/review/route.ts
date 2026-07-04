import { NextRequest, NextResponse } from "next/server";
import { restoreToCheckList, setAdminReviewed } from "@/lib/audit-store";

function backToAdmin(request: NextRequest) {
  return new URL(request.headers.get("referer") || "/admin/items", request.url);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");
  const action = String(formData.get("action") || "");
  if (productId && action === "review") await setAdminReviewed(productId, true);
  if (productId && action === "unreview") await setAdminReviewed(productId, false);
  if (productId && action === "restore") await restoreToCheckList(productId);
  return NextResponse.redirect(backToAdmin(request), 303);
}
