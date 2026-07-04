import { AdminReadyPlan } from "@/components/products/admin-ready-plan";
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

function viewMode(value: string | undefined) {
  if (value === "IN_REPORT" || value === "OUT_REPORT" || value === "CHECKED") return value;
  return "NOT_CHECKED";
}

export default async function AdminItemsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = first(params?.q) ?? "";
  const category = first(params?.category) ?? "";
  const subCategory = first(params?.subCategory) ?? "";
  const limit = Number(first(params?.limit) ?? 60);
  const view = viewMode(first(params?.view));
  const [initialData, auditRecords] = await Promise.all([
    getLiveProductsPage({ q: query, category, subCategory, limit, forceFresh: Boolean(category || subCategory) }),
    readAuditMap()
  ]);
  return <AdminReadyPlan initialData={initialData} auditRecords={auditRecords} initialQuery={query} currentLimit={limit} view={view} refreshedAt={new Date().toISOString()} initialCategory={category} initialSubCategory={subCategory} />;
}
