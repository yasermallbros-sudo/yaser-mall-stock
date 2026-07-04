import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReadyProduct } from "@/lib/ready-products";

type CatalogFile = {
  fetchedAt: string;
  source?: string;
  apiSource?: string;
  categoryCount?: number;
  uniqueProductCount?: number;
  inStock?: number;
  outOfStock?: number;
  categories?: string[];
  categoryTree?: Record<string, string[]>;
  categoryImages?: Record<string, string>;
  productParts?: string[];
  products?: ReadyProduct[];
};

function parseJson<T>(text: string) {
  return JSON.parse(text.replace(/^\uFEFF/, "").trim()) as T;
}

function cleanPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Number(value.toFixed(2));
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
}

function liveStock(product: { quantity?: unknown; stock_status?: unknown }) {
  const quantity = typeof product.quantity === "number" ? product.quantity : Number(product.quantity ?? 0);
  const statusText = String(product.stock_status ?? "").toLowerCase();
  return quantity > 0 || statusText.includes("in stock") || statusText.includes("متوفر") ? "IN_STOCK" : "OUT_OF_STOCK";
}

async function touchJsonFile(file: string, fetchedAt: string) {
  try {
    const raw = await readFile(file, "utf8");
    const data = parseJson<CatalogFile>(raw);
    data.fetchedAt = fetchedAt;
    await writeFile(file, JSON.stringify(data), "utf8");
  } catch {
    // Some deploys do not include every optional catalog file.
  }
}

async function readCatalogWithParts(file: string) {
  const data = parseJson<CatalogFile>(await readFile(file, "utf8"));
  if (!Array.isArray(data.products) && Array.isArray(data.productParts)) {
    const products: ReadyProduct[] = [];
    for (const part of data.productParts) {
      try {
        const rows = parseJson<ReadyProduct[]>(await readFile(path.join(path.dirname(file), part), "utf8"));
        products.push(...rows);
      } catch {
        // Keep syncing the parts that are present.
      }
    }
    data.products = products;
  }
  return data;
}

async function readCatalogIfUsable(file: string) {
  try {
    const data = await readCatalogWithParts(file);
    return (data.products?.length ?? 0) > 0 ? data : null;
  } catch {
    return null;
  }
}

async function writeCatalogWithParts(file: string, data: CatalogFile) {
  if (Array.isArray(data.productParts) && data.productParts.length > 0 && Array.isArray(data.products)) {
    const partSize = Math.ceil(data.products.length / data.productParts.length);
    await Promise.all(data.productParts.map((part, index) => {
      const rows = data.products!.slice(index * partSize, (index + 1) * partSize);
      return writeFile(path.join(path.dirname(file), part), JSON.stringify(rows), "utf8");
    }));
    const indexData = { ...data };
    delete indexData.products;
    await writeFile(file, JSON.stringify(indexData), "utf8");
    return;
  }

  await writeFile(file, JSON.stringify(data), "utf8");
}

function catalogWithProducts(data: CatalogFile, products: ReadyProduct[], fetchedAt: string): CatalogFile {
  const next = { ...data, fetchedAt, products };
  recomputeCatalogCounts(next);
  return next;
}

async function getLiveApiProduct(productId: string) {
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
    if (!response.ok) return null;
    return await response.json() as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeLiveProduct(product: ReadyProduct, live: Record<string, unknown>): ReadyProduct {
  const price = cleanPrice(live.special) || cleanPrice(live.formatted_special) || cleanPrice(live.price) || cleanPrice(live.formatted_price) || product.priceJod;
  const quantity = Number(live.quantity ?? product.quantity ?? 0);
  const name = String(live.name ?? product.arabicName ?? "");
  const englishName = String(live.name_en ?? live.en_name ?? product.englishName ?? name);
  const image = String(live.thumb ?? live.image ?? product.imageUrl ?? "");
  return {
    ...product,
    englishName: englishName || product.englishName,
    arabicName: name || product.arabicName,
    priceJod: price,
    imageUrl: image || product.imageUrl,
    sourceStock: liveStock({ quantity, stock_status: live.stock_status }) as ReadyProduct["sourceStock"],
    quantity: Number.isFinite(quantity) ? quantity : product.quantity
  };
}

function recomputeCatalogCounts(data: CatalogFile) {
  const products = data.products ?? [];
  data.uniqueProductCount = products.length;
  data.inStock = products.filter((product) => product.sourceStock === "IN_STOCK").length;
  data.outOfStock = products.filter((product) => product.sourceStock === "OUT_OF_STOCK").length;
  data.categoryCount = new Set(products.map((product) => product.mainCategory).filter(Boolean)).size;
}

export async function refreshCatalogSyncDate(date = new Date()) {
  const fetchedAt = date.toISOString();
  await Promise.all([
    touchJsonFile(path.join(process.cwd(), "public", "yaser-live-products.txt"), fetchedAt),
    touchJsonFile(path.join(process.cwd(), "public", "yaser-live-instock-products.json"), fetchedAt),
    touchJsonFile(path.join(process.cwd(), "public", "yaser-live-instock-products.txt"), fetchedAt),
    touchJsonFile(path.join(process.cwd(), "data", "fast-catalog.json"), fetchedAt)
  ]);
  return fetchedAt;
}

export async function syncExistingCatalogFromYaser(options: { maxProducts?: number } = {}) {
  const requestedMax = options.maxProducts ?? Number(process.env.LIVE_SYNC_MAX_PRODUCTS ?? 5000);
  const maxProducts = requestedMax <= 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, requestedMax);
  const fetchedAt = new Date().toISOString();
  const fullFile = path.join(process.cwd(), "public", "yaser-live-products.txt");
  const inStockJsonFile = path.join(process.cwd(), "public", "yaser-live-instock-products.json");
  const inStockTextFile = path.join(process.cwd(), "public", "yaser-live-instock-products.txt");
  const fastFile = path.join(process.cwd(), "data", "fast-catalog.json");
  const fullCatalog = await readCatalogIfUsable(fullFile);
  const fallbackCatalog = fullCatalog ? null : await readCatalogIfUsable(inStockJsonFile);
  const data = fullCatalog ?? fallbackCatalog;
  if (!data?.products?.length) {
    return {
      fetchedAt: await refreshCatalogSyncDate(new Date(fetchedAt)),
      updated: 0,
      total: 0,
      maxProducts,
      warning: "Catalog is not available, so sync did not overwrite existing products.",
    };
  }
  const products = data.products ?? [];
  const missingPrice = products.filter((product) => cleanPrice(product.priceJod) <= 0);
  const withPrice = products.filter((product) => cleanPrice(product.priceJod) > 0);
  const targets = [...missingPrice, ...withPrice].slice(0, maxProducts);
  let updated = 0;
  for (let index = 0; index < targets.length; index += 12) {
    const group = targets.slice(index, index + 12);
    const liveRows = await Promise.all(group.map((product) => getLiveApiProduct(String(product.id))));
    group.forEach((product, groupIndex) => {
      const live = liveRows[groupIndex];
      if (!live) return;
      const productIndex = products.findIndex((item) => String(item.id) === String(product.id));
      if (productIndex < 0) return;
      products[productIndex] = mergeLiveProduct(products[productIndex], live);
      updated += 1;
    });
  }
  const updatedFullCatalog = catalogWithProducts(data, products, fetchedAt);
  if (fullCatalog) {
    await writeCatalogWithParts(fullFile, updatedFullCatalog);
  }

  const inStockProducts = products.filter((product) => product.sourceStock === "IN_STOCK");
  const inStockCatalog = catalogWithProducts(
    {
      ...updatedFullCatalog,
      source: updatedFullCatalog.source ?? "https://yasermallonline.com/en/home",
      products: inStockProducts,
    },
    inStockProducts,
    fetchedAt,
  );
  await Promise.all([
    writeFile(inStockJsonFile, JSON.stringify(inStockCatalog), "utf8"),
    writeFile(inStockTextFile, JSON.stringify(inStockCatalog), "utf8"),
  ]);

  const fast = (await readCatalogIfUsable(fastFile)) ?? { fetchedAt };
  fast.fetchedAt = fetchedAt;
  fast.uniqueProductCount = updatedFullCatalog.uniqueProductCount;
  fast.inStock = updatedFullCatalog.inStock;
  fast.outOfStock = updatedFullCatalog.outOfStock;
  fast.categoryCount = updatedFullCatalog.categoryCount;
  if (fast.products?.length) {
    const byId = new Map(products.map((product) => [String(product.id), product]));
    fast.products = fast.products.map((product) => byId.get(String(product.id)) ?? product);
  }
  await writeFile(fastFile, JSON.stringify(fast), "utf8");
  return { fetchedAt, updated, total: products.length, maxProducts };
}
