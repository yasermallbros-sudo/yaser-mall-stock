import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const today = startOfDay(new Date());
  const [totalProducts, checkedToday, grouped, employees] = await Promise.all([
    prisma.product.count(),
    prisma.auditReport.count({ where: { createdAt: { gte: today } } }),
    prisma.auditReport.groupBy({ by: ["status"], _count: { status: true }, where: { createdAt: { gte: today } } }),
    prisma.user.findMany({ select: { id: true, name: true, role: true, _count: { select: { auditReports: true } } }, orderBy: { name: "asc" } })
  ]);
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count.status]));
  return { totalProducts, checkedToday, byStatus, employees };
}
