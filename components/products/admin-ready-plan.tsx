import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ClipboardList, PackageCheck, PackageX, Search, ShieldCheck } from "lucide-react";
import { formatJod, type ReadyProduct } from "@/lib/ready-products";
import type { AuditMap, AuditRecord } from "@/lib/audit-store";
import type { LiveProductsPage } from "@/lib/live-products-file";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ViewMode = "NOT_CHECKED" | "IN_REPORT" | "OUT_REPORT" | "CHECKED";
const PAGE_SIZE = 60;

function cleanDate(value: string) {
  return new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("en-JO", { dateStyle: "full", timeStyle: "medium" }).format(new Date(value));
}

function statusClass(status?: string) {
  return status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
}

function sourceLabel(status?: string) {
  return status === "OUT_OF_STOCK" ? "Yaser: Out Stock" : "Yaser: In Stock";
}

function moreHref(query: string, limit: number, view: ViewMode) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (view !== "NOT_CHECKED") params.set("view", view);
  params.set("limit", String(limit + PAGE_SIZE));
  return "/admin/items?" + params.toString();
}

function viewHref(view: ViewMode, query: string, limit: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (view !== "NOT_CHECKED") params.set("view", view);
  params.set("limit", String(limit));
  return "/admin/items?" + params.toString();
}

function ProductSummary({ product }: { product: ReadyProduct }) {
  return <><div className="relative h-24 w-24 overflow-hidden rounded-lg bg-white"><Image src={product.imageUrl} alt={product.englishName || product.arabicName} fill sizes="96px" className="object-contain p-2" unoptimized /></div><div className="min-w-0 space-y-1"><p className="text-xs font-medium text-muted-foreground">Product ID: {product.id}</p><h2 className="font-semibold">{product.englishName || product.arabicName}</h2><p className="text-sm text-muted-foreground" dir="rtl">{product.arabicName}</p><div className="grid gap-1 pt-1 text-sm text-muted-foreground sm:grid-cols-2"><p><span className="font-medium text-foreground">Main category:</span> {product.mainCategory}</p><p><span className="font-medium text-foreground">Subcategory:</span> {product.subCategory || "-"}</p><p><span className="font-medium text-foreground">Brand:</span> {product.brand}</p><p><span className="font-medium text-foreground">Yaser quantity:</span> {product.quantity ?? "-"}</p></div></div></>;
}

function ReportCard({ record }: { record: AuditRecord }) {
  return <article className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[96px_1fr_auto]"><ProductSummary product={record.product} /><div className="space-y-2 sm:text-right"><p className="text-lg font-bold text-primary">{formatJod(record.product.priceJod)}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (record.status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>{record.status === "OUT_OF_STOCK" ? "Employee: Out Stock" : "Employee: In Stock"}</span><p className="text-xs text-muted-foreground">Checked {cleanDate(record.checkedAt)}</p><p className="text-xs text-muted-foreground">Hidden until {cleanDate(record.hideUntil)}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (record.adminReviewedAt ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{record.adminReviewedAt ? "Admin reviewed" : "Admin not checked"}</span><div className="grid gap-2 pt-2"><form action="/admin/items/review" method="post"><input type="hidden" name="productId" value={record.productId} /><input type="hidden" name="action" value={record.adminReviewedAt ? "unreview" : "review"} /><Button type="submit" size="sm" className="w-full"><CheckCircle2 className="h-4 w-4" />{record.adminReviewedAt ? "Undo review" : "Mark checked"}</Button></form><form action="/admin/items/review" method="post"><input type="hidden" name="productId" value={record.productId} /><input type="hidden" name="action" value="restore" /><Button type="submit" size="sm" variant="outline" className="w-full">Return to check list</Button></form></div></div></article>;
}

export function AdminReadyPlan({ initialData, auditRecords, initialQuery, currentLimit, view, refreshedAt, initialCategory, initialSubCategory }: { initialData: LiveProductsPage; auditRecords: AuditMap; initialQuery: string; currentLimit: number; view: ViewMode; refreshedAt: string; initialCategory?: string; initialSubCategory?: string }) {
  const reportRecords = Object.values(auditRecords).sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  const checkedReports = reportRecords.filter((record) => record.adminReviewedAt);
  const inReports = reportRecords.filter((record) => record.status === "IN_STOCK" && !record.adminReviewedAt);
  const outReports = reportRecords.filter((record) => record.status === "OUT_OF_STOCK" && !record.adminReviewedAt);
  const reviewed = checkedReports.length;
  const notCheckedProducts = initialData.products.filter((product) => !auditRecords[product.id]);
  return <main className="min-h-screen bg-background">
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-2 text-lg font-bold text-primary"><ClipboardList className="h-5 w-5" />Admin Item Plan</div><Link href="/employee" className="text-sm text-muted-foreground underline">Employee app</Link></div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      <section className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Not checked</p><p className="text-2xl font-bold">{notCheckedProducts.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">In report</p><p className="text-2xl font-bold">{inReports.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Out report</p><p className="text-2xl font-bold">{outReports.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Checked items</p><p className="text-2xl font-bold">{checkedReports.length.toLocaleString()}</p></div></section>
      <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"><p>Live source: Yaser Mall online</p><p><span className="font-semibold text-foreground">Page refreshed:</span> {fullDate(refreshedAt)}</p><p><span className="font-semibold text-foreground">Catalog sync date:</span> {fullDate(initialData.fetchedAt)}</p>{(initialCategory || initialSubCategory) && <p><span className="font-semibold text-foreground">Open:</span> {initialSubCategory || initialCategory}</p>}<p>Yaser source stock: {initialData.inStock.toLocaleString()} in stock, {initialData.outOfStock.toLocaleString()} out of stock.</p><p>Admin reviewed reports: {reviewed.toLocaleString()} / {reportRecords.length.toLocaleString()}</p></section>
      <form action="/admin/items" className="rounded-xl border bg-card p-4"><div className="grid max-w-xl gap-2 sm:grid-cols-[1fr_auto]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={initialQuery} className="h-11 rounded-xl pl-9" placeholder="Search product, ID, category" /></div><Button type="submit" className="h-11 rounded-xl">Search</Button></div></form>
      <section className="sticky top-[57px] z-10 grid gap-2 border-b bg-background/95 py-3 backdrop-blur sm:grid-cols-4"><Button asChild variant={view === "NOT_CHECKED" ? "default" : "outline"} className="h-11"><Link href={viewHref("NOT_CHECKED", initialQuery, currentLimit)}><ClipboardList className="h-4 w-4" />Not checked</Link></Button><Button asChild variant={view === "IN_REPORT" ? "default" : "outline"} className="h-11"><Link href={viewHref("IN_REPORT", initialQuery, currentLimit)}><PackageCheck className="h-4 w-4" />In stock report</Link></Button><Button asChild variant={view === "OUT_REPORT" ? "default" : "outline"} className="h-11"><Link href={viewHref("OUT_REPORT", initialQuery, currentLimit)}><PackageX className="h-4 w-4" />Out stock report</Link></Button><Button asChild variant={view === "CHECKED" ? "default" : "outline"} className="h-11"><Link href={viewHref("CHECKED", initialQuery, currentLimit)}><ShieldCheck className="h-4 w-4" />Checked items</Link></Button></section>
      {view === "IN_REPORT" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-primary">In Stock Checked Report ({inReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{inReports.map((record) => <ReportCard key={record.productId} record={record} />)}{inReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No in-stock reports waiting for admin check.</div>}</div></details></section>}
      {view === "OUT_REPORT" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-destructive">Out of Stock Checked Report ({outReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{outReports.map((record) => <ReportCard key={record.productId} record={record} />)}{outReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No out-of-stock reports waiting for admin check.</div>}</div></details></section>}
      {view === "CHECKED" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-primary">Checked Items Report ({checkedReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{checkedReports.map((record) => <ReportCard key={record.productId} record={record} />)}{checkedReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No admin-checked items yet.</div>}</div></details></section>}
      {view === "NOT_CHECKED" && <section className="grid gap-3">{notCheckedProducts.map((product) => <article key={product.id} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[96px_1fr_auto]"><ProductSummary product={product} /><div className="space-y-2 sm:text-right"><p className="text-lg font-bold text-primary">{formatJod(product.priceJod)}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClass(product.sourceStock)}>{sourceLabel(product.sourceStock)}</span><p className="text-xs text-muted-foreground">Not checked by employee</p></div></article>)}{initialData.products.length < initialData.totalFiltered && <Button asChild type="button" variant="outline" className="h-12 w-full rounded-xl"><Link href={moreHref(initialQuery, currentLimit, view)}>Load more ({initialData.products.length.toLocaleString()} / {initialData.totalFiltered.toLocaleString()})</Link></Button>}</section>}
    </div>
  </main>;
}
