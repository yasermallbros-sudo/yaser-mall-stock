"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  englishName?: string | null;
  arabicName?: string | null;
  imageUrl?: string | null;
  mainCategory?: string | null;
  subCategory?: string | null;
  priceJod?: number | string | null;
  quantity?: number | string | null;
};

type EmployeeProductsResponse = {
  fetchedAt?: string;
  categories?: string[];
  categoryTree?: Record<string, string[]>;
  categoryImages?: Record<string, string>;
  totalFiltered?: number;
  products?: Product[];
};

function formatPrice(value: Product["priceJod"]) {
  const amount = Number(value || 0);
  return `JOD ${amount.toFixed(2)}`;
}

export default function EmployeePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [lastSync, setLastSync] = useState("");
  const [status, setStatus] = useState("Loading live items...");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setStatus("Loading live items...");
        const params = new URLSearchParams({
          status: "IN_STOCK",
          limit: "120",
        });
        if (selectedCategory) params.set("category", selectedCategory);
        if (selectedSubCategory) params.set("subCategory", selectedSubCategory);

        const response = await fetch(`/api/employee-products?${params.toString()}`, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error("Could not load products");
        }

        const data = (await response.json()) as EmployeeProductsResponse;
        if (!active) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setCategoryTree(data.categoryTree ?? {});
        setCategoryImages(data.categoryImages ?? {});
        setTotalFiltered(Number(data.totalFiltered ?? data.products?.length ?? 0));
        setLastSync(data.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "");
        setStatus("Ready");
      } catch {
        if (!active) return;
        setProducts([]);
        setStatus("Could not load products. Open admin if this stays empty.");
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [selectedCategory, selectedSubCategory]);

  async function markProduct(productId: string, action: "IN_STOCK" | "OUT_OF_STOCK") {
    const previous = products;
    setProducts((items) => items.filter((item) => item.id !== productId));

    try {
      const body = new FormData();
      body.set("productId", productId);
      body.set("status", action);

      const response = await fetch("/employee/check", {
        method: "POST",
        body,
        headers: {
          accept: "application/json",
          "x-requested-with": "employee-live-check",
        },
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }
    } catch {
      setProducts(previous);
      setStatus("Could not save. Try again.");
    }
  }

  const subCategories = selectedCategory ? categoryTree[selectedCategory] ?? [] : [];

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="font-bold text-emerald-800">Yaser Mall Employee</div>
          <a href="/admin/items" className="text-xs font-semibold text-slate-600 underline">
            Admin
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        <section className="rounded-xl bg-emerald-800 px-4 py-5 text-white shadow-sm">
          <h1 className="text-xl font-bold">Live Stock Check</h1>
          <p className="text-sm text-emerald-50">Tap In or Out. Checked items are removed from this page.</p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Loaded items</p>
            <p className="text-xl font-bold">{products.length} / {totalFiltered}</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold">{status}</p>
            {lastSync ? <p className="mt-1 text-[11px] text-slate-500">{lastSync}</p> : null}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">Main categories</h2>
            {selectedCategory ? (
              <button
                className="rounded-lg border px-3 py-2 text-xs font-semibold text-emerald-700"
                onClick={() => {
                  setSelectedCategory("");
                  setSelectedSubCategory("");
                }}
              >
                All categories
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {categories.map((category) => (
              <button
                key={category}
                className={`min-h-28 rounded-xl border bg-white p-2 text-xs font-semibold shadow-sm ${
                  selectedCategory === category ? "border-emerald-700 ring-1 ring-emerald-700" : "border-slate-200"
                }`}
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedSubCategory("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <img
                  src={categoryImages[category] || "/placeholder.svg"}
                  alt=""
                  className="mx-auto mb-2 h-16 w-full object-contain"
                  loading="lazy"
                />
                <span className="line-clamp-2">{category}</span>
              </button>
            ))}
          </div>

          {selectedCategory ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-600">Subcategories</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                    !selectedSubCategory ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-slate-700"
                  }`}
                  onClick={() => setSelectedSubCategory("")}
                >
                  All
                </button>
                {subCategories.map((subCategory) => (
                  <button
                    key={subCategory}
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                      selectedSubCategory === subCategory ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-slate-700"
                    }`}
                    onClick={() => setSelectedSubCategory(subCategory)}
                  >
                    {subCategory}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full rounded-xl border bg-white p-6 text-center text-sm text-slate-600">
              {status === "Ready" ? "No unchecked in-stock products." : status}
            </div>
          ) : (
            products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="relative h-44 bg-white">
                  <img
                    src={product.imageUrl || "/placeholder.svg"}
                    alt=""
                    className="h-full w-full object-contain p-3"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-2 p-3">
                  <div className="text-xs text-slate-500">{product.id}</div>
                  <h2 className="min-h-10 text-sm font-semibold leading-5">
                    {product.englishName || product.arabicName || "Product"}
                  </h2>
                  <p className="min-h-8 text-xs text-slate-600" dir="rtl">
                    {product.arabicName || ""}
                  </p>
                  <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
                    <p>
                      <b>Main:</b> {product.mainCategory || "-"}
                    </p>
                    <p>
                      <b>Sub:</b> {product.subCategory || "-"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <b className="text-emerald-700">{formatPrice(product.priceJod)}</b>
                    <span className="text-xs text-slate-500">Qty {product.quantity ?? "-"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="h-11 rounded-lg bg-emerald-700 font-semibold text-white"
                      onClick={() => markProduct(product.id, "IN_STOCK")}
                    >
                      In
                    </button>
                    <button
                      className="h-11 rounded-lg bg-red-600 font-semibold text-white"
                      onClick={() => markProduct(product.id, "OUT_OF_STOCK")}
                    >
                      Out
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
