import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

type Product = {
  id: string;
  englishName?: string | null;
  arabicName?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
  mainCategory?: string | null;
  subCategory?: string | null;
  productUrl?: string | null;
  sourceStock?: "IN_STOCK" | "OUT_OF_STOCK" | string | null;
  priceJod?: number | string | null;
  quantity?: number | string | null;
  allCategories?: string[];
};

type Catalog = {
  fetchedAt?: string;
  source?: string;
  categoryCount?: number;
  uniqueProductCount?: number;
  inStock?: number;
  outOfStock?: number;
  categories?: string[];
  subCategories?: string[];
  categoryTree?: Record<string, string[]>;
  categoryImages?: Record<string, string>;
  products?: Product[];
};

const fallbackProducts: Product[] = [
  {
    id: "starter-product",
    englishName: "Starter product",
    arabicName: "منتج تجريبي",
    priceJod: 0,
    imageUrl: "/placeholder.svg",
    brand: "Yaser Mall",
    mainCategory: "Starter",
    subCategory: "Starter",
    productUrl: "https://yasermallonline.com/en/home",
    sourceStock: "IN_STOCK",
    quantity: 1,
    allCategories: ["Starter"],
  },
];

let cachedCatalog: Catalog | null = null;

async function readCatalog() {
  if (cachedCatalog) return cachedCatalog;

  try {
    const file = path.join(process.cwd(), "data", "fast-catalog.json");
    cachedCatalog = JSON.parse(await readFile(file, "utf8")) as Catalog;
  } catch {
    cachedCatalog = {
      fetchedAt: new Date().toISOString(),
      source: "Starter deploy catalog",
      categoryCount: 1,
      uniqueProductCount: 1,
      inStock: 1,
      outOfStock: 0,
      categories: ["Starter"],
      subCategories: ["Starter"],
      categoryTree: { Starter: ["Starter"] },
      categoryImages: { Starter: "/placeholder.svg" },
      products: fallbackProducts,
    };
  }

  return cachedCatalog;
}

function normalizeStock(value: string | null) {
  if (value === "IN_STOCK" || value === "OUT_OF_STOCK") return value;
  return "ALL";
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const category = (params.get("category") ?? "").trim();
    const subCategory = (params.get("subCategory") ?? "").trim();
    const status = normalizeStock(params.get("status"));
    const limit = Math.min(300, Math.max(1, Number(params.get("limit") ?? 60) || 60));

    const catalog = await readCatalog();
    const products = Array.isArray(catalog.products) && catalog.products.length > 0 ? catalog.products : fallbackProducts;
    const filtered = products.filter((product) => {
      const productStatus = product.sourceStock || "IN_STOCK";
      const categories = [product.mainCategory, product.subCategory, ...(product.allCategories ?? [])].filter(Boolean).join(" ");
      const searchText = [product.id, product.englishName, product.arabicName, product.brand, categories].join(" ").toLowerCase();
      const matchesStatus = status === "ALL" || productStatus === status;
      const matchesCategory = !category || categories.includes(category);
      const matchesSub = !subCategory || categories.includes(subCategory);
      return matchesStatus && matchesCategory && matchesSub && (!q || searchText.includes(q));
    });

    return NextResponse.json({
      fetchedAt: catalog.fetchedAt ?? new Date().toISOString(),
      source: catalog.source ?? "Yaser Mall online",
      categoryCount: catalog.categoryCount ?? catalog.categories?.length ?? 0,
      uniqueProductCount: catalog.uniqueProductCount ?? products.length,
      inStock: catalog.inStock ?? products.filter((product) => product.sourceStock !== "OUT_OF_STOCK").length,
      outOfStock: catalog.outOfStock ?? products.filter((product) => product.sourceStock === "OUT_OF_STOCK").length,
      categories: catalog.categories ?? [],
      subCategories: catalog.subCategories ?? [],
      categoryTree: catalog.categoryTree ?? {},
      categoryImages: catalog.categoryImages ?? {},
      totalFiltered: filtered.length,
      products: filtered.slice(0, limit),
    });
  } catch {
    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
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
      products: fallbackProducts,
    });
  }
}
