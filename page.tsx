export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function EmployeePage() {
  const script = `
    const grid = document.querySelector("[data-products]");
    const status = document.querySelector("[data-status]");
    const count = document.querySelector("[data-count]");
    function money(value) {
      return "JOD " + Number(value || 0).toFixed(2);
    }
    function card(product) {
      const image = product.imageUrl || "/placeholder.svg";
      return '<article data-product-id="' + product.id + '" class="overflow-hidden rounded-xl border bg-white shadow-sm">' +
        '<div class="relative h-44 bg-white"><img src="' + image + '" alt="" class="h-full w-full object-contain p-3" loading="lazy" /></div>' +
        '<div class="space-y-2 p-3">' +
        '<div class="text-xs text-slate-500">' + product.id + '</div>' +
        '<h2 class="min-h-10 text-sm font-semibold leading-5">' + (product.englishName || product.arabicName || "Product") + '</h2>' +
        '<p class="min-h-8 text-xs text-slate-600" dir="rtl">' + (product.arabicName || "") + '</p>' +
        '<div class="rounded-lg bg-slate-100 p-2 text-xs text-slate-600"><p><b>Main:</b> ' + (product.mainCategory || "-") + '</p><p><b>Sub:</b> ' + (product.subCategory || "-") + '</p></div>' +
        '<div class="flex items-center justify-between"><b class="text-emerald-700">' + money(product.priceJod) + '</b><span class="text-xs text-slate-500">Qty ' + (product.quantity ?? "-") + '</span></div>' +
        '<div class="grid grid-cols-2 gap-2"><button data-action="IN_STOCK" class="h-11 rounded-lg bg-emerald-700 font-semibold text-white">In</button><button data-action="OUT_OF_STOCK" class="h-11 rounded-lg bg-red-600 font-semibold text-white">Out</button></div>' +
        '</div></article>';
    }
    async function loadProducts() {
      try {
        status.textContent = "Loading live items...";
        const response = await fetch("/api/employee-products?status=IN_STOCK&limit=60", { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error("Load failed");
        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];
        count.textContent = String(products.length);
        grid.innerHTML = products.map(card).join("") || '<div class="rounded-xl border bg-white p-6 text-center text-sm text-slate-600">No products loaded yet. Use Catalog sync now from admin, then refresh.</div>';
        status.textContent = "Ready";
      } catch (error) {
        status.textContent = "Could not load live items. The page is online; check Render logs for the product API.";
        grid.innerHTML = '<div class="rounded-xl border bg-white p-6 text-center text-sm text-slate-600">Employee page opened successfully. Product loading needs the API/log fix next.</div>';
      }
    }
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const cardNode = button.closest("[data-product-id]");
      const productId = cardNode?.getAttribute("data-product-id");
      if (!productId) return;
      button.disabled = true;
      try {
        const body = new FormData();
        body.set("productId", productId);
        body.set("status", button.dataset.action);
        const response = await fetch("/employee/check", { method: "POST", body, headers: { accept: "application/json", "x-requested-with": "employee-live-check" } });
        if (!response.ok) throw new Error("Save failed");
        cardNode.remove();
      } catch {
        button.disabled = false;
        alert("Could not save. Try again.");
      }
    });
    loadProducts();
  `;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="font-bold text-emerald-800">Yaser Mall Employee</div>
          <a href="/admin/items" className="text-xs font-semibold text-slate-600 underline">Admin</a>
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
            <p className="text-xl font-bold" data-count>0</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold" data-status>Opening...</p>
          </div>
        </section>
        <section data-products className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-600">Loading...</div>
        </section>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </main>
  );
}
