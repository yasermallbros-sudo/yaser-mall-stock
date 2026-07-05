import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isHiddenForAudit, readAuditMap } from "@/lib/audit-store";
import { prisma } from "@/lib/prisma";

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
let cachedCatalogKey = "";
let cachedVisibleKey = "";
let cachedVisibleData: { categories: string[]; categoryTree: Record<string, string[]>; categoryImages: Record<string, string> } | null = null;
const livePriceCache = new Map<string, { price: number; expiresAt: number }>();

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

async function fileMtime(file: string) {
  try {
    return String((await stat(file)).mtimeMs);
  } catch {
    return "missing";
  }
}

async function catalogCacheKey() {
  const root = process.cwd();
  const files = [
    path.join(root, "public", "yaser-live-products.txt"),
    path.join(root, "public", "yaser-live-instock-products.json"),
    path.join(root, "public", "yaser-live-instock-products.txt"),
    path.join(root, "data", "fast-catalog.json"),
    path.join(root, "data", "yaser-category-map.json"),
  ];
  let dbKey = "db-missing";
  try {
    const [count, latest] = await Promise.all([
      prisma.product.count(),
      prisma.product.findFirst({
        where: { catalogSyncedAt: { not: null } },
        orderBy: { catalogSyncedAt: "desc" },
        select: { catalogSyncedAt: true },
      }),
    ]);
    dbKey = `${count}:${latest?.catalogSyncedAt?.getTime() ?? 0}`;
  } catch {
    dbKey = "db-error";
  }
  return `${dbKey}:${(await Promise.all(files.map(fileMtime))).join(":")}`;
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

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

async function readDatabaseCatalog(): Promise<Catalog | undefined> {
  const count = await prisma.product.count();
  if (count < 100) return undefined;

  const rows = await prisma.product.findMany({
    select: {
      id: true,
      sourceProductId: true,
      englishName: true,
      arabicName: true,
      price: true,
      imageUrl: true,
      brand: true,
      mainCategory: true,
      subCategory: true,
      sourceStock: true,
      quantity: true,
      allCategories: true,
      productUrl: true,
      catalogSyncedAt: true,
    },
  });

  const products: Product[] = rows.map((row) => ({
    id: row.sourceProductId || row.id,
    englishName: row.englishName,
    arabicName: row.arabicName,
    priceJod: Number(row.price ?? 0),
    imageUrl: row.imageUrl,
    brand: row.brand,
    mainCategory: row.mainCategory,
    subCategory: row.subCategory,
    sourceStock: row.sourceStock === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK",
    quantity: row.quantity === null ? null : Number(row.quantity),
    allCategories: asStringArray(row.allCategories),
    productUrl: row.productUrl,
  }));
  const fetchedAt = rows.reduce<Date | undefined>((latest, row) => {
    if (!row.catalogSyncedAt) return latest;
    return !latest || row.catalogSyncedAt > latest ? row.catalogSyncedAt : latest;
  }, undefined);

  return {
    fetchedAt: (fetchedAt ?? new Date()).toISOString(),
    source: "Yaser Mall online cloud catalog",
    categoryCount: new Set(products.map((product) => product.mainCategory).filter(Boolean)).size,
    uniqueProductCount: products.length,
    inStock: products.filter((product) => product.sourceStock !== "OUT_OF_STOCK").length,
    outOfStock: products.filter((product) => product.sourceStock === "OUT_OF_STOCK").length,
    products,
  } satisfies Catalog;
}

async function readCatalog() {
  const nextCacheKey = await catalogCacheKey();
  if (cachedCatalog && cachedCatalogKey === nextCacheKey) return cachedCatalog;

  try {
    const full = await readFullLiveCatalog().catch(async () => await readDatabaseCatalog());
    if (!full) throw new Error("No full catalog is available.");
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

  cachedCatalogKey = nextCacheKey;
  cachedVisibleKey = "";
  cachedVisibleData = null;
  return cachedCatalog;
}

function normalizeStock(value: string | null) {
  if (value === "IN_STOCK" || value === "OUT_OF_STOCK") return value;
  return "ALL";
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function exactLabelKey(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/&/g, "و")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function exactLabelMatches(left: unknown, right: unknown) {
  const a = exactLabelKey(left);
  const b = exactLabelKey(right);
  return Boolean(a && b && a === b);
}

function cleanPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Number(value.toFixed(2));
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
}

function liveSalePriceFromObject(live: Record<string, unknown>) {
  const saleFields = [
    "special",
    "formatted_special",
    "special_price",
    "formatted_special_price",
    "discount_price",
    "formatted_discount_price",
    "sale_price",
    "formatted_sale_price",
    "final_price",
    "formatted_final_price",
    "new_price",
    "formatted_new_price",
  ];

  for (const field of saleFields) {
    const price = cleanPrice(live[field]);
    if (price > 0) return price;
  }

  return 0;
}

function liveRegularPriceFromObject(live: Record<string, unknown>) {
  return cleanPrice(live.price) || cleanPrice(live.formatted_price);
}

function findLivePriceDeep(value: unknown): { sale: number; regular: number } {
  if (!value || typeof value !== "object") return { sale: 0, regular: 0 };
  if (Array.isArray(value)) {
    return value.reduce((best, item) => {
      const next = findLivePriceDeep(item);
      return { sale: best.sale || next.sale, regular: best.regular || next.regular };
    }, { sale: 0, regular: 0 });
  }

  const object = value as Record<string, unknown>;
  const ownSale = liveSalePriceFromObject(object);
  const ownRegular = liveRegularPriceFromObject(object);
  if (ownSale > 0 || ownRegular > 0) return { sale: ownSale, regular: ownRegular };

  for (const child of Object.values(object)) {
    const next = findLivePriceDeep(child);
    if (next.sale > 0 || next.regular > 0) return next;
  }

  return { sale: 0, regular: 0 };
}

function liveSalePrice(live: Record<string, unknown>) {
  const found = findLivePriceDeep(live);
  return found.sale || found.regular;
}

async function getLivePrice(productId: string) {
  const cached = livePriceCache.get(productId);
  if (cached && cached.expiresAt > Date.now()) return cached.price;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`https://api.yasermallonline.com/index.php?route=api/wkrestapi/catalog/getProduct&product_id=${encodeURIComponent(productId)}&width=400`, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        origin: "https://yasermallonline.com",
        referer: "https://yasermallonline.com/",
      },
    });
    if (!response.ok) return 0;
    const price = liveSalePrice(await response.json() as Record<string, unknown>);
    if (price > 0) livePriceCache.set(productId, { price, expiresAt: Date.now() + 60 * 60 * 1000 });
    return price;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

async function fillMissingLivePrices(products: Product[]) {
  const missing = products.filter((product) => cleanPrice(product.priceJod) <= 0).slice(0, 120);
  const prices: number[] = [];
  for (let index = 0; index < missing.length; index += 12) {
    prices.push(...await Promise.all(missing.slice(index, index + 12).map((product) => getLivePrice(String(product.id)))));
  }
  const byId = new Map(missing.map((product, index) => [String(product.id), prices[index]]));
  return products.map((product) => {
    const price = byId.get(String(product.id)) ?? 0;
    return price > 0 ? { ...product, priceJod: price } : product;
  });
}

function bestSubCategory(product: Product) {
  const current = clean(product.subCategory);
  if (current) return current;

  const main = clean(product.mainCategory);
  const categories = (product.allCategories ?? []).map(clean).filter(Boolean);
  return categories.find((category) => !main || !exactLabelMatches(category, main)) ?? "";
}

function productSubCategoryLabels(product: Product) {
  const main = clean(product.mainCategory);
  return [bestSubCategory(product), ...(product.allCategories ?? [])]
    .map(clean)
    .filter((label) => label && (!main || !exactLabelMatches(label, main)));
}

function productCategoryLabels(product: Product) {
  return [product.mainCategory, ...productSubCategoryLabels(product)].map(clean).filter(Boolean);
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

function productMatchesMainCategory(product: Product, category: string) {
  if (!category) return true;
  return [product.mainCategory, ...(product.allCategories ?? [])].map(clean).filter(Boolean).some((label) => exactLabelMatches(label, category));
}

function productMatchesSubCategory(product: Product, subCategory: string) {
  if (!subCategory) return true;
  const labels = productSubCategoryLabels(product);
  return labels.some((label) => exactLabelMatches(label, subCategory));
}

function categoryImageFor(categoryImages: Record<string, string>, products: Product[], category: string) {
  if (categoryImages[category]) return categoryImages[category];
  return "/placeholder.svg";
}

function buildVisibleCategoryData(catalog: Catalog, products: Product[]) {
  const cacheKey = `${catalog.fetchedAt ?? ""}:${products.length}:${catalog.categories?.length ?? 0}:${Object.keys(catalog.categoryTree ?? {}).length}`;
  if (cachedVisibleData && cachedVisibleKey === cacheKey) return cachedVisibleData;

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
    const sub = bestSubCategory(product);
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

  cachedVisibleKey = cacheKey;
  cachedVisibleData = { categories, categoryTree, categoryImages: images };
  return cachedVisibleData;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const category = clean(params.get("category"));
    const subCategory = clean(params.get("subCategory"));
    const status = normalizeStock(params.get("status"));
    const limit = Math.min(5000, Math.max(1, Number(params.get("limit") ?? 120) || 120));

    const catalog = await readCatalog();
    const products = Array.isArray(catalog.products) && catalog.products.length > 0 ? catalog.products : fallbackProducts;
    const auditRecords = await readAuditMap();
    const statusProducts = products.filter((product) => {
      if (isHiddenForAudit(auditRecords[String(product.id)])) return false;
      return status === "ALL" || (product.sourceStock || "IN_STOCK") === status;
    });
    const visibleCategories = buildVisibleCategoryData(catalog, statusProducts);

    const hasFilter = Boolean(q || category || subCategory);
    const filtered = hasFilter
      ? statusProducts.filter((product) => {
          const labels = productCategoryLabels(product);
          const searchText = [product.id, product.englishName, product.arabicName, product.brand, ...labels].join(" ").toLowerCase();
          const matchesCategory = productMatchesMainCategory(product, category);
          const matchesSub = productMatchesSubCategory(product, subCategory);
          return matchesCategory && matchesSub && (!q || searchText.includes(q));
        })
      : statusProducts;
    const responseProducts = await fillMissingLivePrices(filtered.slice(0, limit).map((product) => ({
      ...product,
      subCategory: bestSubCategory(product),
    })));

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
      products: responseProducts,
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
