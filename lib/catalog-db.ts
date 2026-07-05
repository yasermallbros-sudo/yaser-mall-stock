import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { ReadyProduct } from "@/lib/ready-products";

type CatalogFile = {
  fetchedAt?: string;
  source?: string;
  productParts?: string[];
  products?: ReadyProduct[];
};

type SyncMode = "newOnly" | "full";

function parseJson<T>(text: string) {
  return JSON.parse(text.replace(/^\uFEFF/, "").trim()) as T;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPrice(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(2)) : 0;
}

function cleanQuantity(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

export async function readCatalogProductsFromFiles() {
  const publicDir = path.join(process.cwd(), "public");
  const indexFile = path.join(publicDir, "yaser-live-products.txt");
  const index = parseJson<CatalogFile>(await readFile(indexFile, "utf8"));
  const products: ReadyProduct[] = [];

  if (Array.isArray(index.products)) products.push(...index.products);
  for (const part of index.productParts ?? []) {
    try {
      products.push(...parseJson<ReadyProduct[]>(await readFile(path.join(publicDir, part), "utf8")));
    } catch {
      // Keep importing the available catalog parts.
    }
  }

  const byId = new Map<string, ReadyProduct>();
  for (const product of products) {
    if (product?.id) byId.set(String(product.id), product);
  }

  return {
    fetchedAt: index.fetchedAt ? new Date(index.fetchedAt) : new Date(),
    products: Array.from(byId.values()),
  };
}

function dbRow(product: ReadyProduct, syncedAt: Date) {
  const sourceProductId = cleanText(product.id);
  const englishName = cleanText(product.englishName || product.arabicName || "Yaser Mall product");
  const arabicName = cleanText(product.arabicName || englishName);
  const mainCategory = cleanText(product.mainCategory || "Yaser Mall");
  const subCategory = cleanText(product.subCategory || "");
  const productUrl = cleanText(product.productUrl || `https://yasermallonline.com/en/product/${sourceProductId}`);
  const allCategories = Array.from(new Set([...(product.allCategories ?? []), mainCategory, subCategory].map(cleanText).filter(Boolean)));

  return {
    id: sourceProductId,
    sourceProductId,
    englishName,
    arabicName,
    price: cleanPrice(product.priceJod),
    imageUrl: cleanText(product.imageUrl || "/placeholder.svg"),
    brand: cleanText(product.brand || "Yaser Mall"),
    category: mainCategory,
    mainCategory,
    subCategory,
    sourceStock: product.sourceStock === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK",
    quantity: cleanQuantity(product.quantity),
    allCategories,
    productUrl,
    catalogSyncedAt: syncedAt,
    lastSeenAt: syncedAt,
  };
}

async function upsertBatch(products: ReadyProduct[], syncedAt: Date, mode: SyncMode) {
  if (products.length === 0) return 0;
  const rows = products.map((product) => dbRow(product, syncedAt));
  const columns = [
    "id",
    "sourceProductId",
    "englishName",
    "arabicName",
    "price",
    "imageUrl",
    "brand",
    "category",
    "mainCategory",
    "subCategory",
    "sourceStock",
    "quantity",
    "allCategories",
    "productUrl",
    "catalogSyncedAt",
    "lastSeenAt",
  ];
  const params: unknown[] = [];
  const values = rows.map((row) => {
    const rowValues = [
      row.id,
      row.sourceProductId,
      row.englishName,
      row.arabicName,
      row.price,
      row.imageUrl,
      row.brand,
      row.category,
      row.mainCategory,
      row.subCategory,
      row.sourceStock,
      row.quantity,
      JSON.stringify(row.allCategories),
      row.productUrl,
      row.catalogSyncedAt,
      row.lastSeenAt,
    ];
    const placeholders = rowValues.map((value, columnIndex) => {
      params.push(value);
      const index = params.length;
      return columns[columnIndex] === "allCategories" ? `$${index}::jsonb` : `$${index}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const updateSet = mode === "full"
    ? `"sourceProductId" = EXCLUDED."sourceProductId",
       "englishName" = EXCLUDED."englishName",
       "arabicName" = EXCLUDED."arabicName",
       "price" = EXCLUDED."price",
       "imageUrl" = EXCLUDED."imageUrl",
       "brand" = EXCLUDED."brand",
       "category" = EXCLUDED."category",
       "mainCategory" = EXCLUDED."mainCategory",
       "subCategory" = EXCLUDED."subCategory",
       "sourceStock" = EXCLUDED."sourceStock",
       "quantity" = EXCLUDED."quantity",
       "allCategories" = EXCLUDED."allCategories",
       "catalogSyncedAt" = EXCLUDED."catalogSyncedAt",
       "lastSeenAt" = EXCLUDED."lastSeenAt",
       "updatedAt" = NOW()`
    : `"lastSeenAt" = EXCLUDED."lastSeenAt"`;

  const sql = `
    INSERT INTO "Product" (${columns.map((column) => `"${column}"`).join(", ")}, "createdAt", "updatedAt")
    VALUES ${values.map((value) => value.replace(/\)$/, ", NOW(), NOW())")).join(", ")}
    ON CONFLICT ("productUrl") DO UPDATE SET ${updateSet}
  `;

  await prisma.$executeRawUnsafe(sql, ...params);
  return rows.length;
}

export async function syncCatalogToDatabase(options: { mode?: SyncMode; batchSize?: number } = {}) {
  const mode = options.mode ?? "newOnly";
  const batchSize = options.batchSize ?? 500;
  const { fetchedAt, products } = await readCatalogProductsFromFiles();
  let saved = 0;

  for (let index = 0; index < products.length; index += batchSize) {
    saved += await upsertBatch(products.slice(index, index + batchSize), fetchedAt, mode);
  }

  return { mode, saved, total: products.length, fetchedAt: fetchedAt.toISOString() };
}

export async function shouldRunFullCatalogRefresh() {
  const latest = await prisma.product.findFirst({
    where: { catalogSyncedAt: { not: null } },
    orderBy: { catalogSyncedAt: "desc" },
    select: { catalogSyncedAt: true },
  });
  if (!latest?.catalogSyncedAt) return true;
  return Date.now() - latest.catalogSyncedAt.getTime() >= 30 * 24 * 60 * 60 * 1000;
}
