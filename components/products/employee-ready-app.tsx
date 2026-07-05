"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition, type MouseEvent } from "react";
import { Check, PackageX, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import { formatJod, type ReadyProduct } from "@/lib/ready-products";
import type { AuditMap, AuditRecord, AuditStatus } from "@/lib/audit-store";
import type { LiveProductsPage } from "@/lib/live-products-file";
import { Button } from "@/components/ui/button";
import { EmployeeCategoryFilters } from "@/components/products/employee-category-filters";

type SourceStatus = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
const PAGE_SIZE = 60;
const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "medium", timeZone: "Asia/Amman" });

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function fullDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function isHiddenForAudit(record: AuditRecord | undefined) {
  if (!record) return false;
  return new Date(record.hideUntil).getTime() > Date.now();
}

function sourceLabel(status?: string) {
  return status === "OUT_OF_STOCK" ? "Yaser: Out" : "Yaser: In";
}

function sourceClass(status?: string) {
  return status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
}

function employeeHref(query: string, category: string, subCategory: string, status: SourceStatus, limit?: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (subCategory) params.set("subCategory", subCategory);
  if (status !== "ALL") params.set("status", status);
  if (limit) params.set("limit", String(limit));
  const text = params.toString();
  return text ? "/employee?" + text : "/employee";
}

function apiHref(query: string, category: string, subCategory: string, status: SourceStatus, limit: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (subCategory) params.set("subCategory", subCategory);
  if (status !== "ALL") params.set("status", status);
  params.set("limit", String(limit));
  return "/api/employee-products?" + params.toString();
}

function currentEmployeeHref(query: string, category: string, subCategory: string, status: SourceStatus, limit: number) {
  return employeeHref(query, category, subCategory, status, limit);
}

function EmployeeNoRefreshScript() {
  const script = "" +
    "(function(){" +
    "if(window.__yaserEmployeeCheckReady)return;window.__yaserEmployeeCheckReady=true;" +
    "function numberText(value){return Number(value||0).toLocaleString();}" +
    "function setCounter(name,delta){var node=document.querySelector('[data-counter=\"'+name+'\"]');if(!node)return;var next=Math.max(0,Number(node.getAttribute('data-value')||'0')+delta);node.setAttribute('data-value',String(next));node.textContent=numberText(next);}" +
    "document.addEventListener('click',function(event){var target=event.target;var button=target&&target.closest?target.closest('button[data-action]'):null;if(!button)return;var card=button.closest('[data-product-id]');if(!card||button.getAttribute('data-saving')==='true')return;event.preventDefault();event.stopPropagation();var productId=card.getAttribute('data-product-id')||'';var status=button.getAttribute('data-action')==='out'?'OUT_OF_STOCK':'IN_STOCK';var anchor=card.nextElementSibling||card.previousElementSibling;var anchorTop=anchor?anchor.getBoundingClientRect().top:0;var scrollY=window.scrollY;Array.prototype.forEach.call(card.querySelectorAll('button[data-action]'),function(btn){btn.disabled=true;btn.setAttribute('data-saving','true');});card.style.opacity='0.45';fetch('/employee/check',{method:'POST',body:new URLSearchParams({productId:productId,status:status}),headers:{accept:'application/json','x-requested-with':'employee-live-check','content-type':'application/x-www-form-urlencoded'}}).then(function(response){if(!response.ok)throw new Error('Save failed');return response.json();}).then(function(result){if(!result.ok)throw new Error('Save failed');card.remove();setCounter('visible',-1);setCounter('checked',1);if(status==='IN_STOCK')setCounter('in-report',1);if(status==='OUT_OF_STOCK')setCounter('out-report',1);if(anchor&&anchor.isConnected)window.scrollBy({top:anchor.getBoundingClientRect().top-anchorTop});else window.scrollTo({top:scrollY});}).catch(function(){card.style.opacity='';Array.prototype.forEach.call(card.querySelectorAll('button[data-action]'),function(btn){btn.disabled=false;btn.removeAttribute('data-saving');});});},true);" +
    "})();";
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
function ProductCard({ product, onCheck, disabled }: { product: ReadyProduct; onCheck: (product: ReadyProduct, status: AuditStatus, button: HTMLButtonElement) => void; disabled: boolean }) {
  function handleCheck(event: MouseEvent<HTMLButtonElement>, status: AuditStatus) {
    event.preventDefault();
    event.stopPropagation();
    onCheck(product, status, event.currentTarget);
  }

  return <article data-product-id={product.id} className="overflow-hidden rounded-xl border bg-card shadow-sm transition duration-200 data-[saving=true]:scale-[0.98] data-[saving=true]:opacity-60" data-saving={disabled}>
    <div className="relative aspect-square bg-white"><Image src={product.imageUrl} alt={product.englishName || product.arabicName} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-3" unoptimized /><div className="absolute left-2 top-2 rounded-full bg-background/95 px-2 py-1 text-[11px] font-medium shadow">{product.id}</div><div className={"absolute right-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold " + sourceClass(product.sourceStock)}>{sourceLabel(product.sourceStock)}</div></div>
    <div className="space-y-3 p-3"><div className="min-h-24 space-y-1"><h2 className="line-clamp-2 text-xs font-medium leading-4 text-muted-foreground">{product.englishName || product.arabicName}</h2><p className="line-clamp-2 text-xs font-semibold leading-5 text-foreground" dir="rtl">{product.arabicName}</p></div><div className="space-y-1 rounded-lg bg-muted/60 p-2 text-[11px] text-muted-foreground"><p><span className="font-semibold text-foreground">Main:</span> {product.mainCategory}</p><p><span className="font-semibold text-foreground">Sub:</span> {product.subCategory || "-"}</p></div><div className="flex items-center justify-between gap-2"><p className="text-base font-bold text-primary">{formatJod(product.priceJod)}</p><p className="truncate text-xs text-muted-foreground">Qty {product.quantity ?? "-"}</p></div><div className="grid grid-cols-2 gap-2"><Button type="button" data-action="in" disabled={disabled} onClick={(event) => handleCheck(event, "IN_STOCK")} className="h-11 w-full"><Check className="h-4 w-4" /> In</Button><Button type="button" data-action="out" disabled={disabled} onClick={(event) => handleCheck(event, "OUT_OF_STOCK")} variant="destructive" className="h-11 w-full"><PackageX className="h-4 w-4" /> Out</Button></div></div>
  </article>;
}

export function EmployeeReadyApp({ initialData, auditRecords, initialQuery, initialCategory, initialSubCategory, initialStatus, currentLimit, refreshedAt }: { initialData: LiveProductsPage; auditRecords: AuditMap; initialQuery: string; initialCategory: string; initialSubCategory: string; initialStatus: SourceStatus; currentLimit: number; refreshedAt: string }) {
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => Object.entries(auditRecords).map(([productId]) => String(productId)));
  const [savingIds, setSavingIds] = useState<string[]>(() => []);
  const [localReports, setLocalReports] = useState(() => Object.values(auditRecords));
  const [loadedProducts, setLoadedProducts] = useState(() => initialData.products);
  const [loadedTotalFiltered, setLoadedTotalFiltered] = useState(() => initialData.totalFiltered);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, startTransition] = useTransition();
  const showProducts = Boolean(initialCategory || initialQuery);
  const visibleProducts = useMemo(() => showProducts ? loadedProducts.filter((product) => !hiddenIds.includes(String(product.id))) : [], [hiddenIds, loadedProducts, showProducts]);
  const hasMoreProducts = showProducts && loadedProducts.length < loadedTotalFiltered;
  const nextLimit = Math.min(loadedTotalFiltered, loadedProducts.length + PAGE_SIZE);
  const inReportCount = localReports.filter((record) => record.status === "IN_STOCK").length;
  const outReportCount = localReports.filter((record) => record.status === "OUT_OF_STOCK").length;

  useEffect(() => {
    document.body.dataset.employeeAppReady = "true";
  }, []);

  useEffect(() => {
    setLoadedProducts(initialData.products);
    setLoadedTotalFiltered(initialData.totalFiltered);
    setLoadingMore(false);
  }, [initialData.products, initialData.totalFiltered, initialCategory, initialSubCategory, initialStatus, initialQuery]);

  const loadMoreProducts = useCallback(() => {
    if (!hasMoreProducts || loadingMore) return;
    const scrollY = window.scrollY;
    setLoadingMore(true);
    fetch(apiHref(initialQuery, initialCategory, initialSubCategory, initialStatus, nextLimit), { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("Load more failed");
        return response.json() as Promise<LiveProductsPage>;
      })
      .then((data) => {
        setLoadedProducts(data.products);
        setLoadedTotalFiltered(data.totalFiltered);
        requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
      })
      .catch(() => null)
      .finally(() => setLoadingMore(false));
  }, [hasMoreProducts, loadingMore, initialQuery, initialCategory, initialSubCategory, initialStatus, nextLimit]);

  useEffect(() => {
    if (!hasMoreProducts || loadingMore) return;
    let frame = 0;
    function checkScrollPosition() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const page = document.documentElement;
        const distanceFromBottom = page.scrollHeight - window.scrollY - window.innerHeight;
        if (distanceFromBottom < 1400) loadMoreProducts();
      });
    }
    const sentinel = document.querySelector("[data-load-more-sentinel]");
    const observer = sentinel ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreProducts();
    }, { rootMargin: "1200px 0px" }) : null;
    observer?.observe(sentinel as Element);
    window.addEventListener("scroll", checkScrollPosition, { passive: true });
    window.addEventListener("resize", checkScrollPosition);
    const initialCheck = window.setTimeout(checkScrollPosition, 250);
    const interval = window.setInterval(checkScrollPosition, 500);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [hasMoreProducts, loadingMore, loadMoreProducts]);

  function markProduct(product: ReadyProduct, status: AuditStatus, button: HTMLButtonElement) {
    const productId = String(product.id);
    if (savingIds.includes(productId)) return;
    const card = button.closest<HTMLElement>("[data-product-id]");
    const anchor = (card?.nextElementSibling as HTMLElement | null) ?? (card?.previousElementSibling as HTMLElement | null);
    const anchorId = anchor?.dataset.productId;
    const anchorTop = anchor?.getBoundingClientRect().top ?? 0;
    const scrollY = window.scrollY;
    setSavingIds((current) => current.includes(productId) ? current : [...current, productId]);
    startTransition(() => {
      setHiddenIds((current) => current.includes(productId) ? current : [...current, productId]);
      setLocalReports((current) => [{ productId: product.id, status, checkedAt: new Date().toISOString(), hideUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), product }, ...current.filter((record) => record.productId !== product.id)]);
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    });

    const body = new FormData();
    body.set("productId", product.id);
    body.set("status", status);
    fetch("/employee/check", { method: "POST", body, headers: { accept: "application/json", "x-requested-with": "employee-live-check" } })
      .then((response) => {
        if (!response.ok) throw new Error("Save failed");
        return response.json();
      })
      .then((result) => {
        if (!result.ok) throw new Error("Save failed");
      })
      .catch(() => {
        setHiddenIds((current) => current.filter((id) => id !== productId));
        setLocalReports((current) => current.filter((record) => record.productId !== product.id));
      })
      .finally(() => setSavingIds((current) => current.filter((id) => id !== productId)));
  }

  return <main className="min-h-screen bg-background pb-20"><script src="/employee-check.js?v=3" defer /><script src="/employee-auto-load.js?v=1" defer />
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"><div className="flex items-center gap-2 font-bold text-primary"><ShoppingBag className="h-5 w-5" />Yaser Mall Employee</div><Link href="/admin/items" className="text-xs font-medium text-muted-foreground underline">Admin plan</Link></div></header>
    <div className="mx-auto max-w-md space-y-4 px-3 py-4 sm:max-w-5xl">
      <section className="rounded-xl bg-primary px-4 py-5 text-primary-foreground shadow-sm"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-white/15"><ShieldCheck className="h-6 w-6" /></div><div><h1 className="text-xl font-bold">Live Stock Check</h1><p className="text-sm text-primary-foreground/80">Tap In or Out. Checked items disappear from this list for 30 days.</p></div></div></section>
      <section className="grid grid-cols-3 gap-2"><div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Live items</p><p className="text-xl font-bold">{formatCount(initialData.uniqueProductCount)}</p></div><div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Checked</p><p className="text-xl font-bold"><span data-counter="checked" data-value={localReports.length}>{formatCount(localReports.length)}</span></p></div><div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Out report</p><p className="text-xl font-bold"><span data-counter="out-report" data-value={outReportCount}>{formatCount(outReportCount)}</span></p></div></section>
      <section className="grid grid-cols-2 gap-2"><div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Yaser in stock</p><p className="text-lg font-bold text-primary">{formatCount(initialData.inStock)}</p></div><div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Yaser out stock</p><p className="text-lg font-bold text-destructive">{formatCount(initialData.outOfStock)}</p></div></section>
      <section className="rounded-xl border bg-card p-3 text-xs text-muted-foreground"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="space-y-1"><p>Live source: Yaser Mall online</p><p><span className="font-semibold text-foreground">Page refreshed:</span> {fullDate(refreshedAt)}</p><p><span className="font-semibold text-foreground">Catalog sync date:</span> {fullDate(initialData.fetchedAt)}</p>{initialCategory && <p><span className="font-semibold text-foreground">Open:</span> {initialSubCategory || initialCategory}</p>}<p>Showing unchecked on this page: <span data-counter="visible" data-value={visibleProducts.length}>{formatCount(visibleProducts.length)}</span> / {formatCount(loadedTotalFiltered)}</p><p>In-stock checked report: <span data-counter="in-report" data-value={inReportCount}>{formatCount(inReportCount)}</span></p></div><form action="/employee/sync-catalog" method="post" className="shrink-0"><input type="hidden" name="returnTo" value={currentEmployeeHref(initialQuery, initialCategory, initialSubCategory, initialStatus, loadedProducts.length)} /><Button type="submit" size="sm" variant="outline" className="h-10 w-full rounded-xl text-xs sm:w-auto"><RefreshCw className="h-4 w-4" />Catalog sync now</Button></form></div></section>
      <EmployeeCategoryFilters initialQuery={initialQuery} initialCategory={initialCategory} initialSubCategory={initialSubCategory} initialStatus={initialStatus} categoryTree={initialData.categoryTree} categoryImages={initialData.categoryImages} />
      {showProducts && visibleProducts.length === 0 && <section className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">All loaded items are checked for the next 30 days. Load more or search another category.</section>}
      {showProducts && <section data-products-grid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} disabled={savingIds.includes(String(product.id))} onCheck={markProduct} />)}</section>}
      {hasMoreProducts && <div data-load-more-sentinel data-loaded={loadedProducts.length} data-total={loadedTotalFiltered} className="space-y-2"><Button type="button" variant="outline" className="h-12 w-full rounded-xl" disabled={loadingMore} onClick={loadMoreProducts} data-auto-load-more>{loadingMore ? "Loading more items..." : `Auto load more (${formatCount(loadedProducts.length)} / ${formatCount(loadedTotalFiltered)})`}</Button><p className="text-center text-xs text-muted-foreground">{loadingMore ? "Loading items..." : "Scroll down to load more automatically"}</p></div>}
    </div>
  </main>;
}
