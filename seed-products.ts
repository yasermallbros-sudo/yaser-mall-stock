import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const products = [
  { englishName: "Galaxy Milk Chocolate", arabicName: "جالكسي شوكولاتة بالحليب", price: 4.5, brand: "Galaxy", category: "Chocolate", productUrl: "https://yasermallonline.com/en/products/sample-galaxy" },
  { englishName: "Nadec Long Life Milk 1L", arabicName: "نادك حليب طويل الاجل 1 لتر", price: 6.95, brand: "Nadec", category: "Dairy", productUrl: "https://yasermallonline.com/en/products/sample-nadec-milk" },
  { englishName: "Almarai Fresh Laban 2L", arabicName: "المراعي لبن طازج 2 لتر", price: 9.5, brand: "Almarai", category: "Dairy", productUrl: "https://yasermallonline.com/en/products/sample-almarai-laban" },
  { englishName: "Ariel Detergent Powder", arabicName: "اريال مسحوق غسيل", price: 32.95, brand: "Ariel", category: "Cleaning", productUrl: "https://yasermallonline.com/en/products/sample-ariel" },
  { englishName: "Pampers Baby Dry", arabicName: "بامبرز بيبي دراي", price: 74.95, brand: "Pampers", category: "Baby Care", productUrl: "https://yasermallonline.com/en/products/sample-pampers" },
  { englishName: "Tide Liquid Detergent", arabicName: "تايد سائل غسيل", price: 28.75, brand: "Tide", category: "Cleaning", productUrl: "https://yasermallonline.com/en/products/sample-tide" },
  { englishName: "Lays Salt Chips", arabicName: "ليز بطاطس ملح", price: 3.5, brand: "Lays", category: "Snacks", productUrl: "https://yasermallonline.com/en/products/sample-lays" },
  { englishName: "Pepsi Can 330ml", arabicName: "بيبسي علبة 330 مل", price: 2.5, brand: "Pepsi", category: "Drinks", productUrl: "https://yasermallonline.com/en/products/sample-pepsi" }
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { productUrl: product.productUrl },
      update: product,
      create: product
    });
  }
  console.log("Seeded", products.length, "sample Yaser Mall checklist products");
}

main().finally(() => prisma.$disconnect());
