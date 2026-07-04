import { prisma } from "@/lib/prisma";

export type ReportFilters = { employee?: string; date?: string; category?: string; brand?: string; status?: string };
export function buildReportWhere(filters: ReportFilters) {
  return {
    ...(filters.employee ? { userId: filters.employee } : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.date ? { createdAt: { gte: new Date(filters.date), lt: new Date(new Date(filters.date).getTime() + 86400000) } } : {}),
    product: { ...(filters.category ? { category: filters.category } : {}), ...(filters.brand ? { brand: filters.brand } : {}) }
  };
}
export async function getReports(filters: ReportFilters) {
  return prisma.auditReport.findMany({ where: buildReportWhere(filters), include: { user: true, product: true, photos: true }, orderBy: { createdAt: "desc" }, take: 500 });
}
