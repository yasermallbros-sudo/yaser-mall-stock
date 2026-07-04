export type ReadyProduct = {
  id: string;
  englishName: string;
  arabicName: string;
  priceJod: number;
  imageUrl: string;
  brand: string;
  mainCategory: string;
  subCategory: string;
  productUrl?: string;
  sourceStock?: "IN_STOCK" | "OUT_OF_STOCK";
  quantity?: number;
  allCategories?: string[];
};

export const readyProducts: ReadyProduct[] = [
  { id: "YM-1001", englishName: "Galaxy Milk Chocolate 40g", arabicName: "Galaxy chocolate milk 40g", priceJod: 0.65, brand: "Galaxy", mainCategory: "Food", subCategory: "Chocolate", imageUrl: "/sample-products/galaxy.svg" },
  { id: "YM-1002", englishName: "Nadec Long Life Milk 1L", arabicName: "Nadec long life milk 1L", priceJod: 1.35, brand: "Nadec", mainCategory: "Food", subCategory: "Dairy", imageUrl: "/sample-products/milk.svg" }
];

export function formatJod(value: number) {
  return new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD", minimumFractionDigits: 2 }).format(value);
}
