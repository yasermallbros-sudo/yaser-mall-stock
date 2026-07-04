import { EmployeeReadyApp } from "@/components/products/employee-ready-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stockFilter(value: string | undefined) {
  if (value === "ALL" || value === "OUT_OF_STOCK") return value;
  return "IN_STOCK";
}

function normalizeCategory(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "kitco") return "\u0643\u064a\u062a\u0643\u0648";
  return value;
}

function starterEmployeePage() {
  return {
    fetchedAt: "2026-07-04T00:00:00.000Z",
    source: "Starter deploy catalog",
    categoryCount: 1,
    uniqueProductCount: 1,
    inStock: 1,
    outOfStock: 0,
    categories: ["Starter"],
    subCategories: ["Starter"],
    categoryTree: { Starter: ["Starter"] },
    categoryImages: { Starter: "/placeholder.svg" },
    totalFiltered: 1,
    products: [
      {
        id: "starter-product",
        englishName: "Starter product",
        arabicName: "\u0645\u0646\u062a\u062c \u062a\u062c\u0631\u064a\u0628\u064a",
        priceJod: 0,
        imageUrl: "/placeholder.svg",
        brand: "Yaser Mall",
        mainCategory: "Starter",
        subCategory: "Starter",
        sourceStock: "IN_STOCK" as const,
        productUrl: "https://yasermallonline.com/en/home",
        allCategories: ["Starter"]
      }
    ]
  };
}

export default async function EmployeePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = first(params?.q) ?? "";
  const category = normalizeCategory(first(params?.category) ?? "");
  const subCategory = first(params?.subCategory) ?? "";
  const status = stockFilter(first(params?.status));
  const limit = Number(first(params?.limit) ?? 60);
  return <EmployeeReadyApp initialData={starterEmployeePage()} auditRecords={{}} initialQuery={query} initialCategory={category} initialSubCategory={subCategory} initialStatus={status} currentLimit={limit} refreshedAt="2026-07-04T00:00:00.000Z" />;
}
