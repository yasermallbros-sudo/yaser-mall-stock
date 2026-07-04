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
const livePriceCache = new Map<string, number>();

async function readJson<T>(file: string) {
  const text = await readFile(file, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, "").trim()) as T;
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

  const source = String(index.source ?? "").toLowerCase();
  if (products.length === 0 || (products.length <= 1 && source.includes("starter"))) {
    throw new Error("Full live product parts are not available.");
  }

  return { ...index, products };
}

async function readPublicInStockCatalog() {
  const publicDir = path.join(process.cwd(), "public");
  const files = ["yaser-live-instock-products.json", "yaser-live-instock-products.txt"];

  for (const fileName of files) {
    try {
      const catalog = await readJson<Catalog>(path.join(publicDir, fileName));
      if (Array.isArray(catalog.products) && catalog.products.length > 0) {
        return {
          ...catalog,
          products: catalog.products.map((product) => ({
            ...product,
            sourceStock: product.sourceStock || "IN_STOCK",
          })),
        };
      }
    } catch {
      // Try the next public catalog file.
    }
  }

  throw new Error("Public in-stock catalog is not available.");
}

async function readBestFallbackCatalog() {
  const catalogs: Catalog[] = [];

  try {
    catalogs.push(await readPublicInStockCatalog());
  } catch {
    // Public full catalog is optional on hosted deploys.
  }

  try {
    catalogs.push(await readJson<Catalog>(path.join(process.cwd(), "data", "fast-catalog.json")));
  } catch {
    // The starter fallback below keeps the app online.
  }

  const realCatalogs = catalogs.filter((catalog) => Array.isArray(catalog.products) && catalog.products.length > 0);
  realCatalogs.sort((a, b) => (b.products?.length ?? 0) - (a.products?.length ?? 0));
  if (realCatalogs[0]) return realCatalogs[0];

  throw new Error("No fallback catalog is available.");
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
      const inStockCatalog = await readBestFallbackCatalog();
      const fast = await readOptionalCatalog(path.join(process.cwd(), "data", "fast-catalog.json"));
      const map = await readOptionalCatalog(path.join(process.cwd(), "data", "yaser-category-map.json"));
      cachedCatalog = {
        ...inStockCatalog,
        categories: map?.categories ?? fast?.categories ?? inStockCatalog.categories ?? [],
        categoryTree: map?.categoryTree ?? fast?.categoryTree ?? inStockCatalog.categoryTree ?? {},
        categoryImages: map?.categoryImages ?? fast?.categoryImages ?? inStockCatalog.categoryImages ?? {},
        outOfStock: inStockCatalog.outOfStock ?? 0,
        inStock: inStockCatalog.inStock ?? inStockCatalog.products?.length ?? 0,
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

function cleanPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Number(value.toFixed(2));
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
}

async function getLiveApiPrice(productId: string) {
  if (livePriceCache.has(productId)) return livePriceCache.get(productId) ?? 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const url = `https://api.yasermallonline.com/index.php?route=api/wkrestapi/catalog/getProduct&product_id=${encodeURIComponent(productId)}&width=400`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        origin: "https://yasermallonline.com",
        referer: "https://yasermallonline.com/",
      },
    });
    if (!response.ok) return 0;
    const product = await response.json() as { special?: unknown; formatted_special?: unknown; price?: unknown; formatted_price?: unknown };
    const price = cleanPrice(product.special) || cleanPrice(product.formatted_special) || cleanPrice(product.price) || cleanPrice(product.formatted_price);
    if (price > 0) livePriceCache.set(productId, price);
    return price;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

async function hydrateMissingPrices(products: Product[]) {
  const targets = products.filter((product) => cleanPrice(product.priceJod) <= 0).slice(0, 30);
  if (targets.length === 0) return products;

  const priceById = new Map<string, number>();
  for (let index = 0; index < targets.length; index += 10) {
    const group = targets.slice(index, index + 10);
    const prices = await Promise.all(group.map((product) => getLiveApiPrice(String(product.id))));
    group.forEach((product, groupIndex) => {
      if (prices[groupIndex] > 0) priceById.set(String(product.id), prices[groupIndex]);
    });
  }

  if (priceById.size === 0) return products;
  return products.map((product) => {
    const price = priceById.get(String(product.id));
    return price ? { ...product, priceJod: price } : product;
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function productCategoryLabels(product: Product) {
  return [product.mainCategory, product.subCategory, ...(product.allCategories ?? [])].map(clean).filter(Boolean);
}

function comparableLabel(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/(^|[\s/&-])ال/g, "$1")
    .replace(/وال/g, "و")
    .replace(/&/g, "و")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function labelTokens(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/&/g, " و ")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.replace(/^وال/, "").replace(/^ال/, "").replace(/^و/, ""))
    .map((token) => token.replace(/(ات|يه|ية|ه|ة)$/u, ""))
    .filter((token) => token.length >= 3 && token !== "and");
}

function labelMatches(left: string, right: string) {
  const a = comparableLabel(left);
  const b = comparableLabel(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length >= 5 && longer.includes(shorter)) return true;

  const leftTokens = labelTokens(left);
  const rightTokens = labelTokens(right);
  return leftTokens.some((leftToken) =>
    rightTokens.some((rightToken) => leftToken === rightToken || leftToken.includes(rightToken) || rightToken.includes(leftToken)),
  );
}

function productMatchesLabel(product: Product, label: string) {
  return productCategoryLabels(product).some((productLabel) => labelMatches(productLabel, label));
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

  for (const category of catalog.categories ?? []) {
    const cleanCategory = clean(category);
    if (!cleanCategory) continue;
    categorySet.add(cleanCategory);
    tree[cleanCategory] ??= new Set<string>();
  }

  for (const [main, subs] of Object.entries(existingTree)) {
    const cleanMain = clean(main);
    if (!cleanMain) continue;
    categorySet.add(cleanMain);
    tree[cleanMain] ??= new Set<string>();
    for (const sub of subs ?? []) {
      const cleanSub = clean(sub);
      if (cleanSub) tree[cleanMain].add(cleanSub);
    }
  }

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

    const filtered = statusProducts.filter((product) => {
      const labels = productCategoryLabels(product);
      const searchText = [product.id, product.englishName, product.arabicName, product.brand, ...labels].join(" ").toLowerCase();
      const matchesCategory = !category || (subCategory ? true : productMatchesLabel(product, category));
      const matchesSub = !subCategory || productMatchesLabel(product, subCategory);
      return matchesCategory && matchesSub && (!q || searchText.includes(q));
    });

    const pageProducts = await hydrateMissingPrices(filtered.slice(0, limit));

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
      products: pageProducts,
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
