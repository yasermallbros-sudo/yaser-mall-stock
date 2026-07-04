import { NextRequest, NextResponse } from "next/server";
import { getLiveProductsPage, type LiveProductsPage } from "@/lib/live-products-file";

function stockFilter(value: string | null) {
  if (value === "IN_STOCK" || value === "OUT_OF_STOCK") return value;
  return "ALL";
}

function normalizeCategory(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "kitco") return "\u0643\u064a\u062a\u0643\u0648";
  return value;
}

function starterEmployeePage(): LiveProductsPage {
  return {
    fetchedAt: "2026-07-04T00:00:00.000Z",
    source: "Starter deploy catalog",
    categoryCount: 1,
    uniqueProductCount: 1,
    inStock: 1,
    outOfStock: 0,
    categories: ["Starter"],
    subCategories: ["Starter"],
    categoryTree: { Starter: ["Starter"] },
    categoryImages: { Starter: "/placeholder.svg" },
    totalFiltered: 1,
    products: [
      {
        id: "starter-product",
        englishName: "Starter product",
        arabicName: "\u0645\u0646\u062a\u062c \u062a\u062c\u0631\u064a\u0628\u064a",
        priceJod: 0,
        imageUrl: "/placeholder.svg",
        brand: "Yaser Mall",
        mainCategory: "Starter",
        subCategory: "Starter",
        sourceStock: "IN_STOCK",
        productUrl: "https://yasermallonline.com/en/home",
        allCategories: ["Starter"]
      }
    ]
  };
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
    return starterEmployeePage();
  });
  return NextResponse.json(data);
}
