import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import path from "node:path";
import { gunzipSync } from "node:zlib";
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

function bestSubCategory(product: ReadyProduct, mainCategory: string) {
  const current = cleanText(product.subCategory);
  if (current) return current;
  return (product.allCategories ?? [])
    .map(cleanText)
    .find((category) => category && category !== mainCategory) ?? "";
}

async function readOptionalCatalogFile(file: string) {
  try {
    return parseJson<CatalogFile>(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

async function readCatalogProductsFromIndex(file: string) {
  const index = await readOptionalCatalogFile(file);
  const products: ReadyProduct[] = [];

  if (Array.isArray(index?.products)) products.push(...index.products);
  for (const part of index?.productParts ?? []) {
    try {
      products.push(...parseJson<ReadyProduct[]>(await readFile(path.join(path.dirname(file), part), "utf8")));
    } catch {
      // Keep importing the catalog files that exist on this server.
    }
  }

  return {
    fetchedAt: index?.fetchedAt ? new Date(index.fetchedAt) : undefined,
    products,
  };
}

async function readCompressedCatalog(file: string) {
  try {
    const compressed = (await readFile(file, "utf8")).trim();
    const catalog = parseJson<CatalogFile>(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
    return {
      fetchedAt: catalog.fetchedAt ? new Date(catalog.fetchedAt) : undefined,
      products: Array.isArray(catalog.products) ? catalog.products : [],
    };
  } catch {
    return {
      fetchedAt: undefined,
      products: [],
    };
  }
}

function cleanQuantity(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

export async function readCatalogProductsFromFiles() {
  const publicDir = path.join(process.cwd(), "public");
  const dataDir = path.join(process.cwd(), "data");
  const catalogs = await Promise.all([
    readCompressedCatalog(path.join(dataDir, "yaser-live-products.full.json.gz.b64")),
    readCatalogProductsFromIndex(path.join(publicDir, "yaser-live-products.txt")),
    readCatalogProductsFromIndex(path.join(publicDir, "yaser-live-instock-products.json")),
    readCatalogProductsFromIndex(path.join(publicDir, "yaser-live-instock-products.txt")),
    readCatalogProductsFromIndex(path.join(dataDir, "fast-catalog.json")),
  ]);
  const bestCatalog = catalogs
    .filter((catalog) => catalog.products.length > 0)
    .sort((a, b) => b.products.length - a.products.length)[0];

  if (!bestCatalog) {
    return {
      fetchedAt: new Date(),
      products: [],
    };
  }

  const byId = new Map<string, ReadyProduct>();
  for (const product of bestCatalog.products) {
    if (product?.id) byId.set(String(product.id), product);
  }

  return {
    fetchedAt: bestCatalog.fetchedAt ?? new Date(),
    products: Array.from(byId.values()),
  };
}

function dbRow(product: ReadyProduct, syncedAt: Date) {
  const sourceProductId = cleanText(product.id);
  const englishName = cleanText(product.englishName || product.arabicName || "Yaser Mall product");
  const arabicName = cleanText(product.arabicName || englishName);
  const mainCategory = cleanText(product.mainCategory || "Yaser Mall");
  const subCategory = bestSubCategory(product, mainCategory);
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
  const { products } = await readCatalogProductsFromFiles();
  const fetchedAt = new Date();
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
