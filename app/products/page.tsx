import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { ProductCard } from "@/components/products/product-card";
import { Input } from "@/components/ui/input";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) { const user = await requireUser(); const { q } = await searchParams; const products = await prisma.product.findMany({ where: q ? { OR: [{ englishName: { contains: q, mode: "insensitive" } }, { arabicName: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : undefined, orderBy: { updatedAt: "desc" }, take: 60 }); return <AppShell user={user}><div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-2xl font-bold">Products</h1><form><Input name="q" placeholder="Search products" defaultValue={q} /></form></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div></div></AppShell>; }
