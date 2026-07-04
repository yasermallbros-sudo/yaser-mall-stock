import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ productId: z.string().min(1), status: z.enum(["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK", "WRONG_IMAGE", "WRONG_NAME", "WRONG_PRICE", "WRONG_CATEGORY", "DUPLICATE_PRODUCT"]), notes: z.string().optional() });
export async function POST(req: Request) {
  const user = await requireUser();
  const form = await req.formData();
  const data = schema.parse(Object.fromEntries(form));
  const report = await prisma.auditReport.create({ data: { productId: data.productId, userId: user.id, status: data.status, notes: data.notes } });
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg";
    const fileName = `${report.id}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), Buffer.from(await photo.arrayBuffer()));
    await prisma.auditPhoto.create({ data: { auditReportId: report.id, url: `/uploads/${fileName}`, fileName: photo.name, contentType: photo.type || "application/octet-stream" } });
  }
  return NextResponse.json({ id: report.id });
}
