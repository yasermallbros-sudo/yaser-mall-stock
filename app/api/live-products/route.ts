import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReadyProduct } from "@/lib/ready-products";

type LiveProductData = {
  fetchedAt: string;
  source: string;
  categoryCount: number;
  uniqueProductCount: number;
  inStock: number;
  outOfStock: number;
  products: ReadyProduct[];
};

let cachedData: LiveProductData | null = null;

async function getLiveData() {
  if (cachedData) return cachedData;
  const file = path.join(process.cwd(), "public", "yaser-live-instock-products.txt");
  cachedData = JSON.parse(await readFile(file, "utf8")) as LiveProductData;
  return cachedData;
}

export async function GET(request: NextRequest) {
  const data = await getLiveData();
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = searchParams.get("category") ?? "";
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
  const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit") ?? 120)));

  const categories = Array.from(new Set(data.products.map((product) => product.mainCategory).filter(Boolean))).sort();
  const filtered = data.products.filter((product) => {
    const haystack = [product.id, product.englishName, product.arabicName, product.brand, product.mainCategory, product.subCategory].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!category || product.mainCategory === category);
  });

  return NextResponse.json({
    fetchedAt: data.fetchedAt,
    source: data.source,
    categoryCount: data.categoryCount,
    uniqueProductCount: data.uniqueProductCount,
    inStock: data.inStock,
    outOfStock: data.outOfStock,
    categories,
    totalFiltered: filtered.length,
    products: filtered.slice(offset, offset + limit)
  });
}
