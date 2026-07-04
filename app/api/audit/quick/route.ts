import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  productId: z.string().min(1),
  status: z.enum(["IN_STOCK", "OUT_OF_STOCK"])
});

export async function POST(req: Request) {
  const user = await requireUser();
  const data = schema.parse(await req.json());
  const report = await prisma.auditReport.create({
    data: {
      productId: data.productId,
      userId: user.id,
      status: data.status,
      notes: data.status === "IN_STOCK" ? "Quick employee check: in stock" : "Quick employee check: out of stock"
    }
  });
  return NextResponse.json({ id: report.id, status: data.status });
}
