import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReadyProduct } from "@/lib/ready-products";

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

export async function readAuditMap(): Promise<AuditMap> {
  try {
    const records = JSON.parse(await readFile(auditFile(), "utf8")) as AuditMap;
    const now = Date.now();
    let changed = false;

    for (const [productId, record] of Object.entries(records)) {
      if (new Date(record.hideUntil).getTime() <= now) {
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

export async function writeAuditMap(records: AuditMap) {
  await mkdir(path.dirname(auditFile()), { recursive: true });
  await writeFile(auditFile(), JSON.stringify(records, null, 2), "utf8");
}

export async function saveEmployeeCheck(product: ReadyProduct, status: AuditStatus) {
  const records = await readAuditMap();
  const now = new Date();
  records[product.id] = {
    productId: product.id,
    status,
    checkedAt: now.toISOString(),
    hideUntil: hideUntilFrom(now),
    product
  };
  await writeAuditMap(records);
}

export async function setAdminReviewed(productId: string, reviewed: boolean) {
  const records = await readAuditMap();
  const record = records[productId];
  if (!record) return;
  records[productId] = { ...record, adminReviewedAt: reviewed ? new Date().toISOString() : undefined };
  await writeAuditMap(records);
}

export async function restoreToCheckList(productId: string) {
  const records = await readAuditMap();
  delete records[productId];
  await writeAuditMap(records);
}

export function isHiddenForAudit(record: AuditRecord | undefined) {
  if (!record) return false;
  return new Date(record.hideUntil).getTime() > Date.now();
}
