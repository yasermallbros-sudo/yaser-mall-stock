"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SourceStatus = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";

function hrefFor(params: { q: string; category?: string; subCategory?: string; status: SourceStatus }) {
  const url = new URLSearchParams();
  if (params.q) url.set("q", params.q);
  if (params.category) url.set("category", params.category);
  if (params.subCategory) url.set("subCategory", params.subCategory);
  url.set("status", params.status);
  const text = url.toString();
  return text ? "/employee?" + text : "/employee";
}

function CategoryTile({ href, image, label, active, allLabel }: { href: string; image?: string; label: string; active?: boolean; allLabel?: boolean }) {
  return <Link href={href} prefetch={false} className={"group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:border-primary " + (active ? "border-primary ring-2 ring-primary/20" : "") }>
    {allLabel ? <div className="grid aspect-square place-items-center bg-primary/10 text-center text-sm font-bold text-primary">All</div> : <div className="relative aspect-square bg-white"><Image src={image || "/sample-products/galaxy.svg"} alt={label} fill sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw" className="object-contain p-2 transition group-hover:scale-105" unoptimized /></div>}
    <div className="flex min-h-12 items-center justify-center p-2 text-center text-[11px] font-semibold leading-4" dir="rtl">{label.trim()}</div>
  </Link>;
}

export function EmployeeCategoryFilters({ initialQuery, initialCategory, initialSubCategory, initialStatus, categoryTree, categoryImages }: { initialQuery: string; initialCategory: string; initialSubCategory: string; initialStatus: SourceStatus; categoryTree: Record<string, string[]>; categoryImages: Record<string, string> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const mainCategories = useMemo(() => Object.keys(categoryTree).sort(), [categoryTree]);
  const subCategories = useMemo(() => initialCategory ? categoryTree[initialCategory] ?? [] : [], [initialCategory, categoryTree]);

  function submitSoon() {
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return <section className="space-y-3">
    <form ref={formRef} action="/employee" className="rounded-xl border bg-card p-3">
      <input type="hidden" name="category" value={initialCategory} />
      <input type="hidden" name="subCategory" value={initialSubCategory} />
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={initialQuery} className="h-11 rounded-xl pl-9" placeholder="Search product, ID, Arabic, English" /></div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><select name="status" defaultValue={initialStatus} onChange={submitSoon} className="h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="ALL">All live items</option><option value="IN_STOCK">Yaser in stock</option><option value="OUT_OF_STOCK">Yaser out stock</option></select><Button type="submit" className="h-11 rounded-xl">Search</Button></div>
    </form>

    {!initialCategory && <div className="space-y-2">
      <div className="rounded-xl border bg-card p-3"><p className="text-sm font-semibold">Main categories</p></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {mainCategories.map((name) => <CategoryTile key={name} href={hrefFor({ q: initialQuery, category: name, status: initialStatus })} image={categoryImages[name]} label={name} />)}
      </div>
    </div>}

    {initialCategory && <div className="space-y-3">
      <div className="grid grid-cols-[112px_1fr] gap-3 rounded-xl border bg-card p-3">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-white"><Image src={categoryImages[initialCategory] || "/sample-products/galaxy.svg"} alt={initialCategory} fill sizes="112px" className="object-contain p-2" unoptimized /></div>
        <div className="flex flex-col justify-center gap-2"><Link href="/employee" prefetch={false} className="text-xs font-medium text-primary underline">All main categories</Link><h2 className="text-lg font-bold leading-6" dir="rtl">{initialCategory.trim()}</h2><p className="text-xs font-semibold text-muted-foreground">Subcategories</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <CategoryTile href={hrefFor({ q: initialQuery, category: initialCategory, status: initialStatus })} image={categoryImages[initialCategory]} label={'All ' + initialCategory.trim()} active={!initialSubCategory} />
        {subCategories.map((name) => <CategoryTile key={name} href={hrefFor({ q: initialQuery, category: initialCategory, subCategory: name, status: initialStatus })} image={categoryImages[name] || categoryImages[initialCategory]} label={name} active={initialSubCategory === name} />)}
      </div>
    </div>}
  </section>;
}
