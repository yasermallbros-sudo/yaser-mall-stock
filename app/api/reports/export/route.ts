import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { NextResponse } from "next/server";
import { auditLabels } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getReports } from "@/lib/reports";

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url); const format = url.searchParams.get("format") ?? "xlsx";
  const filters = Object.fromEntries(url.searchParams.entries());
  const reports = await getReports(filters);
  const rows = reports.map((r) => ({ date: r.createdAt.toISOString(), employee: r.user.name, product: r.product.englishName, arabicName: r.product.arabicName ?? "", status: auditLabels[r.status], category: r.product.category ?? "", brand: r.product.brand ?? "", notes: r.notes ?? "" }));
  if (format === "pdf") {
    const doc = new jsPDF(); doc.text("Yaser Mall Stock Report", 14, 16); let y = 28;
    rows.slice(0, 45).forEach((r) => { doc.text(`${r.date.slice(0,10)} | ${r.employee} | ${r.status} | ${r.product}`, 14, y); y += 6; });
    return new NextResponse(Buffer.from(doc.output("arraybuffer")), { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=yaser-mall-report.pdf" } });
  }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Reports");
  ws.columns = Object.keys(rows[0] ?? { date: "", employee: "", product: "", arabicName: "", status: "", category: "", brand: "", notes: "" }).map((key) => ({ header: key, key, width: 24 }));
  ws.addRows(rows); ws.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=yaser-mall-report.xlsx" } });
}
