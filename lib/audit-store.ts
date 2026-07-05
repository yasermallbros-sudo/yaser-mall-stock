import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReadyProduct } from "@/lib/ready-products";
import { prisma } from "@/lib/prisma";

export type AuditStatus = "IN_STOCK" | "OUT_OF_STOCK";
export type AuditRecord = {
  productId: string;
  status: AuditStatus;
  checkedAt: string;
  hideUntil: string;
  product: ReadyProduct;
  adminReviewedAt?: string;
};
export type AuditMap = Record<string, AuditRecord>;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function auditFile() {
  return path.join(process.cwd(), "data", "audit-reports.json");
}

export function hideUntilFrom(date: Date) {
  return new Date(date.getTime() + THIRTY_DAYS_MS).toISOString();
}

function safeDate(value: unknown, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function normalizeProduct(value: unknown): ReadyProduct {
  const product = (value && typeof value === "object" ? value : {}) as Partial<ReadyProduct>;
  const id = String(product.id ?? "");
  const englishName = String(product.englishName || product.arabicName || "Yaser Mall product");
  const mainCategory = String(product.mainCategory || "Yaser Mall");
  return {
    id,
    englishName,
    arabicName: String(product.arabicName || englishName),
    priceJod: Number(product.priceJod || 0),
    imageUrl: String(product.imageUrl || "/placeholder.svg"),
    brand: String(product.brand || "Yaser Mall"),
    mainCategory,
    subCategory: String(product.subCategory || ""),
    productUrl: String(product.productUrl || ""),
    sourceStock: product.sourceStock === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK",
    quantity: product.quantity === undefined ? undefined : Number(product.quantity),
    allCategories: Array.isArray(product.allCategories) ? product.allCategories.map(String).filter(Boolean) : [mainCategory],
  };
}

async function readLegacyAuditMap(): Promise<AuditMap> {
  try {
    const records = JSON.parse(await readFile(auditFile(), "utf8")) as AuditMap;
    const now = Date.now();
    let changed = false;

    for (const [productId, record] of Object.entries(records)) {
      if (record.adminReviewedAt && new Date(record.hideUntil).getTime() <= now) {
        delete records[productId];
        changed = true;
      }
    }

    if (changed) await writeAuditMap(records);
    return records;
  } catch {
    return {};
  }
}

export async function readAuditMap(): Promise<AuditMap> {
  const legacy = await readLegacyAuditMap();

  try {
    await prisma.employeeAuditAction.deleteMany({
      where: {
        adminReviewedAt: { not: null },
        hideUntil: { lte: new Date() },
      },
    });

    const rows = await prisma.employeeAuditAction.findMany();
    const records = { ...legacy };
    for (const row of rows) {
      const checkedAt = safeDate(row.checkedAt);
      const hideUntil = safeDate(row.hideUntil, new Date(checkedAt.getTime() + THIRTY_DAYS_MS));
      records[row.productId] = {
        productId: row.productId,
        status: row.status === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK",
        checkedAt: checkedAt.toISOString(),
        hideUntil: hideUntil.toISOString(),
        product: normalizeProduct(row.product),
        adminReviewedAt: row.adminReviewedAt ? safeDate(row.adminReviewedAt).toISOString() : undefined,
      };
    }
    return records;
  } catch {
    return legacy;
  }
}

export async function writeAuditMap(records: AuditMap) {
  await mkdir(path.dirname(auditFile()), { recursive: true });
  await writeFile(auditFile(), JSON.stringify(records, null, 2), "utf8");
}

export async function saveEmployeeCheck(product: ReadyProduct, status: AuditStatus) {
  const now = new Date();
  const hideUntil = new Date(now.getTime() + THIRTY_DAYS_MS);
  try {
    await prisma.employeeAuditAction.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        status,
        checkedAt: now,
        hideUntil,
        product,
      },
      update: {
        status,
        checkedAt: now,
        hideUntil,
        product,
        adminReviewedAt: null,
      },
    });
  } catch {
    const records = await readLegacyAuditMap();
    records[product.id] = {
      productId: product.id,
      status,
      checkedAt: now.toISOString(),
      hideUntil: hideUntil.toISOString(),
      product,
    };
    await writeAuditMap(records);
  }
}

export async function setAdminReviewed(productId: string, reviewed: boolean) {
  const records = await readAuditMap();
  const record = records[productId];
  if (!record) return;
  const now = new Date();
  const hideUntil = new Date(now.getTime() + THIRTY_DAYS_MS);
  try {
    await prisma.employeeAuditAction.update({
      where: { productId },
      data: reviewed
        ? { adminReviewedAt: now, hideUntil }
        : { adminReviewedAt: null },
    });
  } catch {
    records[productId] = reviewed
      ? { ...record, adminReviewedAt: now.toISOString(), hideUntil: hideUntil.toISOString() }
      : { ...record, adminReviewedAt: undefined };
    await writeAuditMap(records);
  }
}

export async function restoreToCheckList(productId: string) {
  try {
    await prisma.employeeAuditAction.delete({ where: { productId } });
  } catch {
    const records = await readLegacyAuditMap();
    delete records[productId];
    await writeAuditMap(records);
  }
}

export function isHiddenForAudit(record: AuditRecord | undefined) {
  if (!record) return false;
  return new Date(record.hideUntil).getTime() > Date.now();
}
