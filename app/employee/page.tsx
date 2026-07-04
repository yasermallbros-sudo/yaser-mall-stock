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

function formatPrice(value: Product["priceJod"]) {
  const amount = Number(value || 0);
  return `JOD ${amount.toFixed(2)}`;
}

export default function EmployeePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState("Loading live items...");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setStatus("Loading live items...");
        const response = await fetch("/api/employee-products?status=IN_STOCK&limit=60", {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error("Could not load products");
        }

        const data = await response.json();
        if (!active) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
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
  }, []);

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
            <p className="text-xl font-bold">{products.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold">{status}</p>
          </div>
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
