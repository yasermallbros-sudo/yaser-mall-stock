import { EmployeeReadyApp } from "@/components/products/employee-ready-app";
import { readAuditMap } from "@/lib/audit-store";
import { getLiveProductsPage } from "@/lib/live-products-file";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stockFilter(value: string | undefined) {
  if (value === "ALL" || value === "OUT_OF_STOCK") return value;
  return "IN_STOCK";
}

function normalizeCategory(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "kitco") return "\u0643\u064a\u062a\u0643\u0648";
  return value;
}

export default async function EmployeePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = first(params?.q) ?? "";
  const category = normalizeCategory(first(params?.category) ?? "");
  const subCategory = first(params?.subCategory) ?? "";
  const status = stockFilter(first(params?.status));
  const limit = Number(first(params?.limit) ?? 60);
  const [initialData, auditRecords] = await Promise.all([
    getLiveProductsPage({ q: query, category, subCategory, status, limit, forceFresh: Boolean(category || subCategory) }),
    readAuditMap()
  ]);
  return <EmployeeReadyApp initialData={initialData} auditRecords={auditRecords} initialQuery={query} initialCategory={category} initialSubCategory={subCategory} initialStatus={status} currentLimit={limit} refreshedAt={new Date().toISOString()} />;
}
