import { NextRequest, NextResponse } from "next/server";
import { saveEmployeeCheck, type AuditStatus } from "@/lib/audit-store";
import { getLiveProductData } from "@/lib/live-products-file";
import type { ReadyProduct } from "@/lib/ready-products";

function backToEmployee(request: NextRequest) {
  return new URL(request.headers.get("referer") || "/employee", request.url);
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function productFromPayload(value: FormDataEntryValue | null): ReadyProduct | undefined {
  if (!value) return undefined;

  try {
    const raw = JSON.parse(String(value)) as Partial<ReadyProduct>;
    const id = cleanText(raw.id);
    if (!id) return undefined;

    const englishName = cleanText(raw.englishName || raw.arabicName || "Yaser Mall product");
    const mainCategory = cleanText(raw.mainCategory || "Yaser Mall");

    return {
      id,
      englishName,
      arabicName: cleanText(raw.arabicName || englishName),
      priceJod: cleanNumber(raw.priceJod),
      imageUrl: cleanText(raw.imageUrl || "/placeholder.svg"),
      brand: cleanText(raw.brand || "Yaser Mall"),
      mainCategory,
      subCategory: cleanText(raw.subCategory || ""),
      productUrl: cleanText(raw.productUrl || ""),
      sourceStock: raw.sourceStock === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK",
      quantity: raw.quantity === undefined ? undefined : cleanNumber(raw.quantity),
      allCategories: Array.isArray(raw.allCategories)
        ? raw.allCategories.map(cleanText).filter(Boolean)
        : [mainCategory].filter(Boolean),
    };
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");
  const status = String(formData.get("status") || "") as AuditStatus;
  const payloadProduct = productFromPayload(formData.get("product"));
  let product: ReadyProduct | undefined;

  try {
    const data = await getLiveProductData();
    product = data.products.find((item) => item.id === productId);
  } catch {
    product = undefined;
  }

  product ??= payloadProduct;
  const ok = Boolean(product && (status === "IN_STOCK" || status === "OUT_OF_STOCK"));
  if (product && ok) {
    await saveEmployeeCheck(product, status);
  }
  if (request.headers.get("accept")?.includes("application/json") || request.headers.get("x-requested-with") === "employee-live-check") {
    return NextResponse.json({ ok, productId, status, saved: ok });
  }
  return NextResponse.redirect(backToEmployee(request), 303);
}
