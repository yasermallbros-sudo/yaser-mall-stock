import { NextRequest, NextResponse } from "next/server";
import { saveEmployeeCheck, type AuditStatus } from "@/lib/audit-store";
import { getLiveProductData } from "@/lib/live-products-file";

function backToEmployee(request: NextRequest) {
  return new URL(request.headers.get("referer") || "/employee", request.url);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");
  const status = String(formData.get("status") || "") as AuditStatus;
  const data = await getLiveProductData();
  const product = data.products.find((item) => item.id === productId);
  const ok = Boolean(product && (status === "IN_STOCK" || status === "OUT_OF_STOCK"));
  if (product && ok) {
    await saveEmployeeCheck(product, status);
  }
  if (request.headers.get("accept")?.includes("application/json") || request.headers.get("x-requested-with") === "employee-live-check") {
    return NextResponse.json({ ok, productId, status });
  }
  return NextResponse.redirect(backToEmployee(request), 303);
}
