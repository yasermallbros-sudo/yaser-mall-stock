import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ClipboardList, PackageCheck, PackageX, Search, ShieldCheck } from "lucide-react";
import { formatJod, type ReadyProduct } from "@/lib/ready-products";
import type { AuditMap, AuditRecord } from "@/lib/audit-store";
import type { LiveProductsPage } from "@/lib/live-products-file";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ViewMode = "NOT_CHECKED" | "IN_REPORT" | "OUT_REPORT" | "CHECKED";
type SourceStatus = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
const PAGE_SIZE = 60;

function cleanDate(value: string) {
  return new Intl.DateTimeFormat("en-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("en-JO", { dateStyle: "full", timeStyle: "medium" }).format(new Date(value));
}

function nextFullSyncDate(value: string) {
  const date = new Date(value);
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function statusClass(status?: string) {
  return status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
}

function sourceLabel(status?: string) {
  return status === "OUT_OF_STOCK" ? "Yaser: Out Stock" : "Yaser: In Stock";
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function reportSearchText(record: AuditRecord) {
  const product = record.product;
  return [
    product.id,
    product.englishName,
    product.arabicName,
    product.brand,
    product.mainCategory,
    product.subCategory,
    ...(product.allCategories ?? [])
  ].map(clean).join(" ").toLowerCase();
}

function reportMatchesFilters(record: AuditRecord, query: string, category: string, subCategory: string, stockStatus: SourceStatus) {
  const product = record.product;
  const labels = [product.mainCategory, product.subCategory, ...(product.allCategories ?? [])].map(clean).filter(Boolean);
  const matchesQuery = !query || reportSearchText(record).includes(query.toLowerCase());
  const matchesCategory = !category || labels.includes(category);
  const matchesSubCategory = !subCategory || labels.includes(subCategory);
  const matchesStock = stockStatus === "ALL" || product.sourceStock === stockStatus;
  return matchesQuery && matchesCategory && matchesSubCategory && matchesStock;
}

function adminHref(options: { view: ViewMode; query: string; category?: string; subCategory?: string; stockStatus: SourceStatus; limit: number }) {
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  if (options.category) params.set("category", options.category);
  if (options.subCategory) params.set("subCategory", options.subCategory);
  if (options.stockStatus !== "ALL") params.set("stock", options.stockStatus);
  if (options.view !== "NOT_CHECKED") params.set("view", options.view);
  params.set("limit", String(options.limit));
  return "/admin/items?" + params.toString();
}

function moreHref(query: string, category: string, subCategory: string, stockStatus: SourceStatus, limit: number, view: ViewMode) {
  return adminHref({ view, query, category, subCategory, stockStatus, limit: limit + PAGE_SIZE });
}

function viewHref(view: ViewMode, query: string, category: string, subCategory: string, stockStatus: SourceStatus, limit: number) {
  return adminHref({ view, query, category, subCategory, stockStatus, limit });
}

function ProductSummary({ product }: { product: ReadyProduct }) {
  return <><div className="relative h-24 w-24 overflow-hidden rounded-lg bg-white"><Image src={product.imageUrl} alt={product.englishName || product.arabicName} fill sizes="96px" className="object-contain p-2" unoptimized /></div><div className="min-w-0 space-y-1"><p className="text-xs font-medium text-muted-foreground">Product ID: {product.id}</p><h2 className="font-semibold">{product.englishName || product.arabicName}</h2><p className="text-sm text-muted-foreground" dir="rtl">{product.arabicName}</p><div className="grid gap-1 pt-1 text-sm text-muted-foreground sm:grid-cols-2"><p><span className="font-medium text-foreground">Main category:</span> {product.mainCategory}</p><p><span className="font-medium text-foreground">Subcategory:</span> {product.subCategory || "-"}</p><p><span className="font-medium text-foreground">Brand:</span> {product.brand}</p><p><span className="font-medium text-foreground">Yaser quantity:</span> {product.quantity ?? "-"}</p></div></div></>;
}

function ReportCard({ record }: { record: AuditRecord }) {
  return <article className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[96px_1fr_auto]"><ProductSummary product={record.product} /><div className="space-y-2 sm:text-right"><p className="text-lg font-bold text-primary">{formatJod(record.product.priceJod)}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (record.status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>{record.status === "OUT_OF_STOCK" ? "Employee: Out Stock" : "Employee: In Stock"}</span><p className="text-xs text-muted-foreground">Checked {cleanDate(record.checkedAt)}</p><p className="text-xs text-muted-foreground">{record.adminReviewedAt ? `Hidden until ${cleanDate(record.hideUntil)}` : "Stays in admin report until admin action"}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (record.adminReviewedAt ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{record.adminReviewedAt ? "Admin reviewed" : "Admin not checked"}</span><div className="grid gap-2 pt-2"><form action="/admin/items/review" method="post"><input type="hidden" name="productId" value={record.productId} /><input type="hidden" name="action" value={record.adminReviewedAt ? "unreview" : "review"} /><Button type="submit" size="sm" className="w-full"><CheckCircle2 className="h-4 w-4" />{record.adminReviewedAt ? "Undo review" : "Mark checked"}</Button></form><form action="/admin/items/review" method="post"><input type="hidden" name="productId" value={record.productId} /><input type="hidden" name="action" value="restore" /><Button type="submit" size="sm" variant="outline" className="w-full">Return to check list</Button></form></div></div></article>;
}

export function AdminReadyPlan({ initialData, auditRecords, initialQuery, currentLimit, view, refreshedAt, initialCategory, initialSubCategory, initialStockStatus }: { initialData: LiveProductsPage; auditRecords: AuditMap; initialQuery: string; currentLimit: number; view: ViewMode; refreshedAt: string; initialCategory?: string; initialSubCategory?: string; initialStockStatus?: SourceStatus }) {
  const selectedCategory = clean(initialCategory);
  const selectedSubCategory = clean(initialSubCategory);
  const selectedStockStatus = initialStockStatus ?? "ALL";
  const categories = Object.keys(initialData.categoryTree ?? {}).sort();
  const subCategories = selectedCategory ? initialData.categoryTree[selectedCategory] ?? [] : [];
  const reportRecords = Object.values(auditRecords)
    .filter((record) => reportMatchesFilters(record, initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus))
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  const allReportRecords = Object.values(auditRecords);
  const checkedReports = reportRecords.filter((record) => record.adminReviewedAt);
  const inReports = reportRecords.filter((record) => record.status === "IN_STOCK" && !record.adminReviewedAt);
  const outReports = reportRecords.filter((record) => record.status === "OUT_OF_STOCK" && !record.adminReviewedAt);
  const reviewed = checkedReports.length;
  const notCheckedProducts = initialData.products.filter((product) => !auditRecords[product.id]);
  return <main className="min-h-screen bg-background">
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-2 text-lg font-bold text-primary"><ClipboardList className="h-5 w-5" />Admin Item Plan</div><Link href="/employee" className="text-sm text-muted-foreground underline">Employee app</Link></div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      <section className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Not checked</p><p className="text-2xl font-bold">{notCheckedProducts.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">In report</p><p className="text-2xl font-bold">{inReports.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Out report</p><p className="text-2xl font-bold">{outReports.length.toLocaleString()}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Checked items</p><p className="text-2xl font-bold">{checkedReports.length.toLocaleString()}</p></div></section>
      <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"><p>Live source: Yaser Mall online</p><p><span className="font-semibold text-foreground">Page refreshed:</span> {fullDate(refreshedAt)}</p><p><span className="font-semibold text-foreground">Catalog sync date:</span> {fullDate(initialData.fetchedAt)}</p><p><span className="font-semibold text-foreground">Next 30-day full sync:</span> {fullDate(nextFullSyncDate(initialData.fetchedAt))}</p>{(selectedCategory || selectedSubCategory) && <p><span className="font-semibold text-foreground">Open:</span> {selectedSubCategory || selectedCategory}</p>}<p>Yaser source stock: {initialData.inStock.toLocaleString()} in stock, {initialData.outOfStock.toLocaleString()} out of stock.</p><p>Admin reviewed reports: {reviewed.toLocaleString()} / {reportRecords.length.toLocaleString()} shown, {allReportRecords.length.toLocaleString()} total.</p></section>
      <form action="/admin/items" className="rounded-xl border bg-card p-4">
        <input type="hidden" name="view" value={view === "NOT_CHECKED" ? "" : view} />
        <input type="hidden" name="limit" value={currentLimit} />
        <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={initialQuery} className="h-11 rounded-xl pl-9" placeholder="Search product, ID, category" /></div>
          <select name="stock" defaultValue={selectedStockStatus} className="h-11 rounded-xl border bg-background px-3 text-sm">
            <option value="ALL">All Yaser stock</option>
            <option value="IN_STOCK">Yaser in stock</option>
            <option value="OUT_OF_STOCK">Yaser out of stock</option>
          </select>
          <select name="category" defaultValue={selectedCategory} className="h-11 rounded-xl border bg-background px-3 text-sm">
            <option value="">All main categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select name="subCategory" defaultValue={selectedSubCategory} className="h-11 rounded-xl border bg-background px-3 text-sm">
            <option value="">All subcategories</option>
            {subCategories.map((subCategory) => <option key={subCategory} value={subCategory}>{subCategory}</option>)}
          </select>
          <Button type="submit" className="h-11 rounded-xl">Filter</Button>
          <Button asChild type="button" variant="outline" className="h-11 rounded-xl"><Link href={viewHref(view, "", "", "", "ALL", currentLimit)}>Clear</Link></Button>
        </div>
      </form>
      <section className="sticky top-[57px] z-10 grid gap-2 border-b bg-background/95 py-3 backdrop-blur sm:grid-cols-4"><Button asChild variant={view === "NOT_CHECKED" ? "default" : "outline"} className="h-11"><Link href={viewHref("NOT_CHECKED", initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus, currentLimit)}><ClipboardList className="h-4 w-4" />Not checked</Link></Button><Button asChild variant={view === "IN_REPORT" ? "default" : "outline"} className="h-11"><Link href={viewHref("IN_REPORT", initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus, currentLimit)}><PackageCheck className="h-4 w-4" />In stock report</Link></Button><Button asChild variant={view === "OUT_REPORT" ? "default" : "outline"} className="h-11"><Link href={viewHref("OUT_REPORT", initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus, currentLimit)}><PackageX className="h-4 w-4" />Out stock report</Link></Button><Button asChild variant={view === "CHECKED" ? "default" : "outline"} className="h-11"><Link href={viewHref("CHECKED", initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus, currentLimit)}><ShieldCheck className="h-4 w-4" />Checked items</Link></Button></section>
      {view === "IN_REPORT" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-primary">In Stock Checked Report ({inReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{inReports.map((record) => <ReportCard key={record.productId} record={record} />)}{inReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No in-stock reports waiting for admin check.</div>}</div></details></section>}
      {view === "OUT_REPORT" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-destructive">Out of Stock Checked Report ({outReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{outReports.map((record) => <ReportCard key={record.productId} record={record} />)}{outReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No out-of-stock reports waiting for admin check.</div>}</div></details></section>}
      {view === "CHECKED" && <section className="grid gap-3"><details className="rounded-xl border bg-card p-4" open><summary className="cursor-pointer text-sm font-semibold text-primary">Checked Items Report ({checkedReports.length.toLocaleString()})</summary><div className="mt-4 grid gap-3">{checkedReports.map((record) => <ReportCard key={record.productId} record={record} />)}{checkedReports.length === 0 && <div className="rounded-xl border bg-background p-4 text-center text-sm text-muted-foreground">No admin-checked items yet.</div>}</div></details></section>}
      {view === "NOT_CHECKED" && <section className="grid gap-3">{notCheckedProducts.map((product) => <article key={product.id} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[96px_1fr_auto]"><ProductSummary product={product} /><div className="space-y-2 sm:text-right"><p className="text-lg font-bold text-primary">{formatJod(product.priceJod)}</p><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClass(product.sourceStock)}>{sourceLabel(product.sourceStock)}</span><p className="text-xs text-muted-foreground">Not checked by employee</p></div></article>)}{initialData.products.length < initialData.totalFiltered && <Button asChild type="button" variant="outline" className="h-12 w-full rounded-xl"><Link href={moreHref(initialQuery, selectedCategory, selectedSubCategory, selectedStockStatus, currentLimit, view)}>Load more ({initialData.products.length.toLocaleString()} / {initialData.totalFiltered.toLocaleString()})</Link></Button>}</section>}
    </div>
  </main>;
}
