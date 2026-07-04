import { NextRequest, NextResponse } from "next/server";
import { getLiveProductsPage, starterLiveProductsPage } from "@/lib/live-products-file";

function stockFilter(value: string | null) {
  if (value === "IN_STOCK" || value === "OUT_OF_STOCK") return value;
  return "ALL";
}

function normalizeCategory(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "kitco") return "\u0643\u064a\u062a\u0643\u0648";
  return value;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const category = normalizeCategory(params.get("category") ?? "");
  const subCategory = params.get("subCategory") ?? "";
  const status = stockFilter(params.get("status"));
  const limit = Number(params.get("limit") ?? 60);
  const data = await getLiveProductsPage({ q, category, subCategory, status, limit, forceFresh: Boolean(category || subCategory) }).catch((error) => {
    console.error("Employee products API failed", error);
    return starterLiveProductsPage();
  });
  return NextResponse.json(data);
}
