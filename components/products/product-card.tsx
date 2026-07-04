import Image from "next/image";
import { Product } from "@prisma/client";
import { money } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AuditForm } from "@/components/products/audit-form";

export function ProductCard({ product }: { product: Product }) { return <Card className="overflow-hidden"><div className="relative aspect-[4/3] bg-muted">{product.imageUrl ? <Image src={product.imageUrl} alt={product.englishName} fill className="object-contain p-3" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>}</div><CardContent className="space-y-4 pt-5"><div><h3 className="font-semibold">{product.englishName}</h3><p className="text-sm text-muted-foreground" dir="rtl">{product.arabicName ?? "Arabic name missing"}</p></div><div className="grid grid-cols-2 gap-2 text-sm"><span>{money(product.price.toString())}</span><span>{product.mainCategory ?? product.category ?? "No main category"}</span><span>{product.subCategory ?? "No subcategory"}</span><span>{product.brand ?? "No brand"}</span><a className="text-primary underline" href={product.productUrl} target="_blank">Product URL</a></div><AuditForm productId={product.id} /></CardContent></Card>; }
