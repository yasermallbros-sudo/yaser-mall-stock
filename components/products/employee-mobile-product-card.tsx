import Image from "next/image";
import { Product } from "@prisma/client";
import { money } from "@/lib/utils";
import { QuickStockActions } from "@/components/products/quick-stock-actions";

type ProductWithLatest = Product & { auditReports?: Array<{ status: string }>; mainCategory?: string | null; subCategory?: string | null };

export function EmployeeMobileProductCard({ product }: { product: ProductWithLatest }) {
  const latest = product.auditReports?.[0]?.status;
  const latestStatus = latest === "IN_STOCK" || latest === "OUT_OF_STOCK" ? latest : undefined;
  return <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="relative aspect-square bg-white">
      {product.imageUrl ? <Image src={product.imageUrl} alt={product.englishName} fill className="object-contain p-3" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>}
      <div className="absolute left-2 top-2 rounded-full bg-background/95 px-2 py-1 text-[11px] font-medium shadow">ID {product.id.slice(-6).toUpperCase()}</div>
    </div>
    <div className="space-y-3 p-3">
      <div className="min-h-20 space-y-1">
        <h2 className="line-clamp-2 text-sm font-semibold leading-5">{product.englishName}</h2>
        {product.arabicName ? <p className="line-clamp-1 text-xs font-medium text-muted-foreground" dir="rtl">{product.arabicName}</p> : null}
      </div>
      <div className="space-y-1 rounded-lg bg-muted/60 p-2 text-[11px] text-muted-foreground">
        <p><span className="font-semibold text-foreground">Main:</span> {product.mainCategory ?? product.category ?? "No main category"}</p>
        <p><span className="font-semibold text-foreground">Sub:</span> {product.subCategory ?? "No subcategory"}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-primary">{money(product.price.toString())}</p>
        <p className="truncate text-xs text-muted-foreground">{product.brand ?? "Yaser Mall"}</p>
      </div>
      <QuickStockActions productId={product.id} initialStatus={latestStatus} />
    </div>
  </article>;
}
