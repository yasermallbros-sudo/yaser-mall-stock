import { readFile, stat } from "node:fs/promises";
import { Buffer } from "node:buffer";
import path from "node:path";
import type { ReadyProduct } from "@/lib/ready-products";

export type LiveProductData = {
  fetchedAt: string;
  source: string;
  categoryCount: number;
  uniqueProductCount: number;
  inStock: number;
  outOfStock: number;
  products: ReadyProduct[];
};

export type LiveProductsPage = Omit<LiveProductData, "products"> & {
  categories: string[];
  subCategories: string[];
  categoryTree: Record<string, string[]>;
  categoryImages: Record<string, string>;
  totalFiltered: number;
  products: ReadyProduct[];
};

type FastCatalog = Omit<LiveProductsPage, "subCategories" | "totalFiltered">;
type CategoryMap = {
  fetchedAt: string;
  categories: string[];
  categoryTree: Record<string, string[]>;
  categoryImages: Record<string, string>;
};
type IndexedProduct = {
  product: ReadyProduct;
  main: string;
  productSub: string;
  rawMemberships: string[];
  scopedMemberships: string[];
  searchText: string;
};

type OfferFilterGroup = {
  label: string;
  targets: string[];
};

let cachedData: LiveProductData | null = null;
let cachedDataMtime = 0;
let cachedFastCatalog: FastCatalog | null = null;
let cachedFastCatalogMtime = 0;
let cachedIndex: { categories: string[]; categoryTree: Record<string, string[]>; categoryImages: Record<string, string>; childToParents: Record<string, string[]>; indexedProducts: IndexedProduct[] } | null = null;
let cachedCategoryMap: CategoryMap | null = null;
let cachedCategoryMapMtime = 0;
const livePriceCache = new Map<string, number>();

const monthlyBestOffersNames = [
  "\u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0631\u0648\u0636 \u0627\u0644\u0634\u0647\u0631\u064a\u0629",
  "Monthly Best Offers"
];

const monthlyBestOfferFilters: OfferFilterGroup[] = [
  { label: "Beauty & Personal Care offers", targets: ["\u0627\u0644\u0639\u0646\u0627\u064a\u0629 \u0627\u0644\u0634\u062e\u0635\u064a\u0629", "\u0639\u0631\u0648\u0636 \u0627\u0644\u0639\u0646\u0627\u064a\u0629 \u0627\u0644\u0634\u062e\u0635\u064a\u0629"] },
  { label: "Beverages PRO", targets: ["\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a"] },
  { label: "Cleaning & Household Products", targets: ["\u0627\u062f\u0648\u0627\u062a \u0627\u0644\u062a\u0646\u0638\u064a\u0641 \u0627\u0644\u0645\u0646\u0632\u0644\u064a"] },
  { label: "Oils & Ghee", targets: ["\u0632\u064a\u0648\u062a \u0648\u0627\u0644\u0633\u0645\u0646"] },
  { label: "Roastry", targets: ["\u0627\u0644\u0645\u062d\u0645\u0635"] },
  { label: "Tea & Coffee", targets: ["\u0627\u0644\u0634\u0627\u064a \u0648\u0627\u0644\u0642\u0647\u0648\u0629"] }
];

async function getFastCatalog() {
  const file = path.join(process.cwd(), "data", "fast-catalog.json");
  const fileStat = await stat(file);
  const mtime = fileStat.mtimeMs;
  if (cachedFastCatalog && cachedFastCatalogMtime === mtime) return cachedFastCatalog;
  cachedFastCatalog = JSON.parse(await readFile(file, "utf8")) as FastCatalog;
  cachedFastCatalogMtime = mtime;
  return cachedFastCatalog;
}

async function readLiveProductFile(file: string) {
  const data = JSON.parse(await readFile(file, "utf8")) as LiveProductData & { productParts?: string[] };
  if (!Array.isArray(data.products) && Array.isArray(data.productParts)) {
    const products = [];
    for (const part of data.productParts) {
      const partFile = path.join(path.dirname(file), part);
      products.push(...JSON.parse(await readFile(partFile, "utf8")) as ReadyProduct[]);
    }
    data.products = products;
  }
  return data as LiveProductData;
}

async function getCategoryMap() {
  const file = path.join(process.cwd(), "data", "yaser-category-map.json");
  const fileStat = await stat(file);
  const mtime = fileStat.mtimeMs;
  if (cachedCategoryMap && cachedCategoryMapMtime === mtime) return cachedCategoryMap;
  cachedCategoryMap = JSON.parse(await readFile(file, "utf8")) as CategoryMap;
  cachedCategoryMapMtime = mtime;
  cachedIndex = null;
  return cachedCategoryMap;
}

export async function getLiveProductData(options: { forceFresh?: boolean } = {}) {
  const file = path.join(process.cwd(), "public", "yaser-live-products.txt");
  const fileStat = await stat(file);
  const mtime = fileStat.mtimeMs;
  if (cachedData && cachedDataMtime === mtime) return cachedData;
  const data = await readLiveProductFile(file);
  cachedData = data;
  cachedDataMtime = mtime;
  cachedIndex = null;
  return cachedData;
}

function cleanCategory(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function legacyArabic(value: string) {
  return Buffer.from(value, "utf8").toString("latin1");
}

function labelVariants(value: string) {
  return Array.from(new Set([cleanCategory(value), cleanCategory(legacyArabic(value))]));
}

function matchesAnyLabel(value: string, labels: string[]) {
  const cleanValue = cleanCategory(value);
  return labels.some((label) => labelVariants(label).includes(cleanValue));
}

function specialFilterGroupsFor(category: string) {
  if (matchesAnyLabel(category, monthlyBestOffersNames)) return monthlyBestOfferFilters;
  return [];
}

function rowMatchesAnyTarget(row: Pick<IndexedProduct, "main" | "productSub" | "rawMemberships" | "scopedMemberships">, targets: string[]) {
  const values = [row.main, row.productSub, ...row.rawMemberships, ...row.scopedMemberships].map(cleanCategory);
  return targets.some((target) => labelVariants(target).some((variant) => values.includes(variant)));
}

function imageForTarget(categoryImages: Record<string, string>, target: string) {
  return labelVariants(target).map((variant) => categoryImages[variant]).find(Boolean);
}

function rawProductMemberships(product: ReadyProduct, mainCategory: string) {
  const cleanMainCategory = cleanCategory(mainCategory);
  const memberships = new Set<string>();
  if (product.subCategory) memberships.add(cleanCategory(product.subCategory));
  for (const label of product.allCategories ?? []) {
    const parts = label.split(">").map((part) => cleanCategory(part)).filter(Boolean);
    for (const part of parts) {
      if (part && part !== cleanMainCategory) memberships.add(part);
    }
    const cleanLabel = cleanCategory(label);
    if (cleanLabel && cleanLabel !== cleanMainCategory && !cleanLabel.includes(">")) memberships.add(cleanLabel);
  }
  return Array.from(memberships).filter(Boolean);
}

function buildIndex(products: ReadyProduct[], categoryMap?: CategoryMap) {
  const officialCategories = new Set((categoryMap?.categories ?? []).map(cleanCategory));
  const officialTree = Object.fromEntries(Object.entries(categoryMap?.categoryTree ?? {}).map(([main, subs]) => [cleanCategory(main), subs.map(cleanCategory)])) as Record<string, string[]>;
  const categorySets: Record<string, Set<string>> = {};
  const categoryImages: Record<string, string> = {};
  for (const [main, subs] of Object.entries(officialTree)) {
    categorySets[main] = new Set(subs);
  }
  for (const [label, image] of Object.entries(categoryMap?.categoryImages ?? {})) {
    if (image) categoryImages[cleanCategory(label)] = image;
  }

  const indexedProducts: IndexedProduct[] = [];
  for (const originalProduct of products) {
    const productAllCategories = (originalProduct.allCategories ?? []).map(cleanCategory).filter(Boolean);
    const originalMain = cleanCategory(originalProduct.mainCategory || "Other");
    const originalSub = originalProduct.subCategory ? cleanCategory(originalProduct.subCategory) : "";
    const mainMemberships = officialCategories.size > 0
      ? productAllCategories.filter((label) => officialCategories.has(label))
      : [originalMain];
    const rowMains = Array.from(new Set([originalMain, ...mainMemberships].filter(Boolean))).filter((main) => officialCategories.size === 0 || officialCategories.has(main));
    const mains = rowMains.length > 0 ? rowMains : [originalMain];

    for (const main of mains) {
      categorySets[main] ??= new Set<string>();
      if (!categoryImages[main] && originalProduct.imageUrl) categoryImages[main] = originalProduct.imageUrl;
      const officialSubs = new Set(officialTree[main] ?? []);
      const rawMemberships = Array.from(new Set(productAllCategories.filter((label) => label !== main)));
      const scopedMemberships = rawMemberships.filter((membership) => officialSubs.has(membership) || (!officialSubs.size && membership !== main));
      if (originalSub && officialSubs.has(originalSub) && !scopedMemberships.includes(originalSub)) scopedMemberships.push(originalSub);
      for (const membership of scopedMemberships) {
        categorySets[main].add(membership);
        if (!categoryImages[membership] && originalProduct.imageUrl) categoryImages[membership] = originalProduct.imageUrl;
      }
      const displaySub = scopedMemberships[0] || originalSub || "";
      const product = { ...originalProduct, mainCategory: main, subCategory: displaySub };
      indexedProducts.push({
        product,
        main,
        productSub: displaySub || "No subcategory",
        rawMemberships,
        scopedMemberships,
        searchText: [product.id, product.englishName, product.arabicName, product.brand, main, displaySub, ...productAllCategories].join(" ").toLowerCase()
      });
    }
  }

  const categoryTree = Object.fromEntries(Object.entries(categorySets).map(([main, subs]) => [main, Array.from(subs).sort()])) as Record<string, string[]>;
  const childToParents: Record<string, string[]> = {};
  for (const [main, subs] of Object.entries(categoryTree)) {
    for (const sub of subs) {
      childToParents[sub] ??= [];
      childToParents[sub].push(main);
    }
  }
  const categories = (categoryMap?.categories?.length ? categoryMap.categories.map(cleanCategory) : Object.keys(categoryTree)).sort();
  return { categories, categoryTree, categoryImages, childToParents, indexedProducts };
}

function getLiveProductIndex(data: LiveProductData, options: { forceFresh?: boolean; categoryMap?: CategoryMap } = {}) {
  if (cachedIndex && !options.forceFresh) return cachedIndex;
  const index = buildIndex(data.products, options.categoryMap);
  if (options.forceFresh) return index;
  cachedIndex = index;
  return cachedIndex;
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
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `https://api.yasermallonline.com/index.php?route=api/wkrestapi/catalog/getProduct&product_id=${encodeURIComponent(productId)}&width=400`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        origin: "https://yasermallonline.com",
        referer: "https://yasermallonline.com/"
      }
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

async function hydrateMissingPrices(products: ReadyProduct[]) {
  const targets = products.filter((product) => cleanPrice(product.priceJod) <= 0);
  if (targets.length === 0) return products;
  const priceById = new Map<string, number>();
  for (let index = 0; index < targets.length; index += 8) {
    const group = targets.slice(index, index + 8);
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

function isFastDefaultRequest(options: { q?: string; category?: string; subCategory?: string; status?: "ALL" | "IN_STOCK" | "OUT_OF_STOCK"; limit?: number }) {
  return !(options.q ?? "").trim() && !options.category && !options.subCategory && (!options.status || options.status === "ALL") && (options.limit ?? 60) <= 300;
}

export async function getLiveProductsPage(options: { q?: string; category?: string; subCategory?: string; status?: "ALL" | "IN_STOCK" | "OUT_OF_STOCK"; limit?: number; forceFresh?: boolean }) {
  const limit = Math.min(1000, Math.max(1, options.limit ?? 60));
  if (isFastDefaultRequest(options)) {
    const fast = await getFastCatalog();
    return {
      fetchedAt: fast.fetchedAt,
      source: fast.source,
      categoryCount: fast.categoryCount,
      uniqueProductCount: fast.uniqueProductCount,
      inStock: fast.inStock,
      outOfStock: fast.outOfStock,
      categories: fast.categories,
      subCategories: [],
      categoryTree: fast.categoryTree,
      categoryImages: fast.categoryImages,
      totalFiltered: fast.uniqueProductCount,
      products: fast.products.slice(0, limit)
    } satisfies LiveProductsPage;
  }

  const data = await getLiveProductData();
  const categoryMap = await getCategoryMap();
  const query = (options.q ?? "").trim().toLowerCase();
  const category = options.category ?? "";
  const subCategory = options.subCategory ?? "";
  const status = options.status ?? "ALL";
  const index = getLiveProductIndex(data, { forceFresh: options.forceFresh, categoryMap });
  const subCategories = category ? index.categoryTree[category] ?? [] : [];
  const selectedChildren = category ? index.categoryTree[category] ?? [] : [];
  const specialSubGroups = category ? specialFilterGroupsFor(category) : [];
  const specialSubGroup = specialSubGroups.find((group) => group.label === subCategory);
  const filtered = index.indexedProducts.filter(({ product, main, scopedMemberships, rawMemberships, productSub, searchText }) => {
    const matchesStatus = status === "ALL" || product.sourceStock === status;
    const matchesCategory = !category || main === category;
    const matchesSub = !subCategory || productSub === subCategory || scopedMemberships.includes(subCategory) || Boolean(specialSubGroup && rowMatchesAnyTarget({ main, productSub, scopedMemberships, rawMemberships }, specialSubGroup.targets));
    return matchesStatus && (!query || searchText.includes(query)) && matchesCategory && matchesSub;
  });

  const uniqueProducts = Array.from(new Map(filtered.map(({ product }) => [String(product.id), product])).values());
  const pageProducts = uniqueProducts.slice(0, limit);

  return {
    fetchedAt: data.fetchedAt,
    source: data.source,
    categoryCount: data.categoryCount,
    uniqueProductCount: data.uniqueProductCount,
    inStock: data.inStock,
    outOfStock: data.outOfStock,
    categories: index.categories,
    subCategories,
    categoryTree: index.categoryTree,
    categoryImages: index.categoryImages,
    totalFiltered: uniqueProducts.length,
    products: pageProducts
  } satisfies LiveProductsPage;
}
