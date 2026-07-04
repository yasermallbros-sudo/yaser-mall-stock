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
  products?: ReadyProduct[];
};

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
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw) as CatalogFile;
  data.fetchedAt = fetchedAt;
  await writeFile(file, JSON.stringify(data), "utf8");
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
    touchJsonFile(path.join(process.cwd(), "data", "fast-catalog.json"), fetchedAt)
  ]);
  return fetchedAt;
}

export async function syncExistingCatalogFromYaser(options: { maxProducts?: number } = {}) {
  const maxProducts = Math.max(1, options.maxProducts ?? Number(process.env.LIVE_SYNC_MAX_PRODUCTS ?? 1200));
  const fetchedAt = new Date().toISOString();
  const fullFile = path.join(process.cwd(), "public", "yaser-live-products.txt");
  const fastFile = path.join(process.cwd(), "data", "fast-catalog.json");
  const data = JSON.parse(await readFile(fullFile, "utf8")) as CatalogFile;
  const products = data.products ?? [];
  const targets = products.slice(0, maxProducts);
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
  data.products = products;
  data.fetchedAt = fetchedAt;
  recomputeCatalogCounts(data);
  await writeFile(fullFile, JSON.stringify(data), "utf8");

  const fast = JSON.parse(await readFile(fastFile, "utf8")) as CatalogFile;
  fast.fetchedAt = fetchedAt;
  fast.uniqueProductCount = data.uniqueProductCount;
  fast.inStock = data.inStock;
  fast.outOfStock = data.outOfStock;
  fast.categoryCount = data.categoryCount;
  if (fast.products?.length) {
    const byId = new Map(products.map((product) => [String(product.id), product]));
    fast.products = fast.products.map((product) => byId.get(String(product.id)) ?? product);
  }
  await writeFile(fastFile, JSON.stringify(fast), "utf8");
  return { fetchedAt, updated, total: products.length, maxProducts };
}
