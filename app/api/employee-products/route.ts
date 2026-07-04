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
  productParts?: string[];
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

async function readJson<T>(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readOptionalCatalog(file: string) {
  try {
    return await readJson<Catalog>(file);
  } catch {
    return undefined;
  }
}

async function readFullLiveCatalog() {
  const publicDir = path.join(process.cwd(), "public");
  const indexFile = path.join(publicDir, "yaser-live-products.txt");
  const index = await readJson<Catalog>(indexFile);
  const products: Product[] = [];

  for (const part of index.productParts ?? []) {
    try {
      products.push(...await readJson<Product[]>(path.join(publicDir, part)));
    } catch {
      // Keep the app online if one part is not present on the server yet.
    }
  }

  if (products.length === 0 && Array.isArray(index.products)) {
    products.push(...index.products);
  }

  return { ...index, products };
}

async function readCatalog() {
  if (cachedCatalog) return cachedCatalog;

  try {
    const full = await readFullLiveCatalog();
    const fast = await readOptionalCatalog(path.join(process.cwd(), "data", "fast-catalog.json"));
    const map = await readOptionalCatalog(path.join(process.cwd(), "data", "yaser-category-map.json"));
    cachedCatalog = {
      ...full,
      categories: map?.categories ?? fast?.categories ?? full.categories ?? [],
      categoryTree: map?.categoryTree ?? fast?.categoryTree ?? full.categoryTree ?? {},
      categoryImages: map?.categoryImages ?? fast?.categoryImages ?? full.categoryImages ?? {},
    };
  } catch {
    try {
      cachedCatalog = await readJson<Catalog>(path.join(process.cwd(), "data", "fast-catalog.json"));
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
  }

  if (!Array.isArray(cachedCatalog.products) || cachedCatalog.products.length === 0) {
    cachedCatalog.products = fallbackProducts;
  }

  return cachedCatalog;
}

function normalizeStock(value: string | null) {
  if (value === "IN_STOCK" || value === "OUT_OF_STOCK") return value;
  return "ALL";
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function productCategoryLabels(product: Product) {
  return [product.mainCategory, product.subCategory, ...(product.allCategories ?? [])].map(clean).filter(Boolean);
}

function categoryImageFor(categoryImages: Record<string, string>, products: Product[], category: string) {
  if (categoryImages[category]) return categoryImages[category];
  return products.find((product) => productCategoryLabels(product).includes(category) && product.imageUrl)?.imageUrl ?? "/placeholder.svg";
}

function buildVisibleCategoryData(catalog: Catalog, products: Product[]) {
  const existingTree = catalog.categoryTree ?? {};
  const categorySet = new Set<string>();
  const tree: Record<string, Set<string>> = {};
  const categoryImages: Record<string, string> = { ...(catalog.categoryImages ?? {}) };

  for (const product of products) {
    const main = clean(product.mainCategory);
    const sub = clean(product.subCategory);
    if (main) {
      categorySet.add(main);
      tree[main] ??= new Set<string>();
      if (sub) tree[main].add(sub);
      if (!categoryImages[main] && product.imageUrl) categoryImages[main] = product.imageUrl;
    }
  }

  for (const [main, subs] of Object.entries(existingTree)) {
    const cleanMain = clean(main);
    if (!cleanMain || !categorySet.has(cleanMain)) continue;
    for (const sub of subs ?? []) {
      const cleanSub = clean(sub);
      if (cleanSub && products.some((product) => clean(product.mainCategory) === cleanMain && productCategoryLabels(product).includes(cleanSub))) {
        tree[cleanMain]?.add(cleanSub);
      }
    }
  }

  const categories = Array.from(categorySet).filter(Boolean).sort();
  const categoryTree = Object.fromEntries(categories.map((category) => [
    category,
    Array.from(tree[category] ?? []).filter(Boolean).sort(),
  ])) as Record<string, string[]>;
  const images = Object.fromEntries(categories.map((category) => [
    category,
    categoryImageFor(categoryImages, products, category),
  ])) as Record<string, string>;

  return { categories, categoryTree, categoryImages: images };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const category = clean(params.get("category"));
    const subCategory = clean(params.get("subCategory"));
    const status = normalizeStock(params.get("status"));
    const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 120) || 120));

    const catalog = await readCatalog();
    const products = Array.isArray(catalog.products) && catalog.products.length > 0 ? catalog.products : fallbackProducts;
    const statusProducts = products.filter((product) => status === "ALL" || (product.sourceStock || "IN_STOCK") === status);
    const visibleCategories = buildVisibleCategoryData(catalog, statusProducts);
    const officialSubs = category ? new Set(visibleCategories.categoryTree[category] ?? []) : new Set<string>();

    const filtered = statusProducts.filter((product) => {
      const productStatus = product.sourceStock || "IN_STOCK";
      const labels = productCategoryLabels(product);
      const searchText = [product.id, product.englishName, product.arabicName, product.brand, ...labels].join(" ").toLowerCase();
      const productMain = clean(product.mainCategory);
      const productSub = clean(product.subCategory);
      const matchesCategory = !category || productMain === category || labels.includes(category);
      const matchesSub = !subCategory || productSub === subCategory || labels.includes(subCategory);
      const belongsToSelectedMain = !category || !subCategory || officialSubs.size === 0 || officialSubs.has(subCategory);
      return matchesCategory && matchesSub && belongsToSelectedMain && (!q || searchText.includes(q));
    });

    return NextResponse.json({
      fetchedAt: catalog.fetchedAt ?? new Date().toISOString(),
      source: catalog.source ?? "Yaser Mall online",
      categoryCount: visibleCategories.categories.length,
      uniqueProductCount: catalog.uniqueProductCount ?? products.length,
      inStock: catalog.inStock ?? products.filter((product) => product.sourceStock !== "OUT_OF_STOCK").length,
      outOfStock: catalog.outOfStock ?? products.filter((product) => product.sourceStock === "OUT_OF_STOCK").length,
      ...visibleCategories,
      subCategories: category ? visibleCategories.categoryTree[category] ?? [] : [],
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
