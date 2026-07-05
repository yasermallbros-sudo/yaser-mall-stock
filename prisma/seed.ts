import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { syncCatalogToDatabase } from "../lib/catalog-db";

const prisma = new PrismaClient();

const users = [
  { name: "Admin", email: "admin@yasermall.local", role: Role.ADMIN, password: "Admin123!" },
  { name: "Supervisor", email: "supervisor@yasermall.local", role: Role.SUPERVISOR, password: "Supervisor123!" },
  { name: "Employee", email: "employee@yasermall.local", role: Role.EMPLOYEE, password: "Employee123!" }
];

const products = [
  { englishName: "Galaxy Milk Chocolate 40g", arabicName: "جالكسي شوكولاتة بالحليب 40 جم", price: 0.65, brand: "Galaxy", category: "Food", mainCategory: "Food", subCategory: "Chocolate", imageUrl: "/sample-products/galaxy.svg", productUrl: "https://yasermallonline.com/en/products/sample-galaxy" },
  { englishName: "Nadec Long Life Milk 1L", arabicName: "نادك حليب طويل الأجل 1 لتر", price: 1.35, brand: "Nadec", category: "Food", mainCategory: "Food", subCategory: "Dairy", imageUrl: "/sample-products/milk.svg", productUrl: "https://yasermallonline.com/en/products/sample-nadec-milk" },
  { englishName: "Almarai Fresh Laban 2L", arabicName: "المراعي لبن طازج 2 لتر", price: 1.85, brand: "Almarai", category: "Food", mainCategory: "Food", subCategory: "Dairy", imageUrl: "/sample-products/laban.svg", productUrl: "https://yasermallonline.com/en/products/sample-almarai-laban" },
  { englishName: "Ariel Detergent Powder", arabicName: "اريال مسحوق غسيل", price: 6.95, brand: "Ariel", category: "Household", mainCategory: "Household", subCategory: "Laundry", imageUrl: "/sample-products/ariel.svg", productUrl: "https://yasermallonline.com/en/products/sample-ariel" },
  { englishName: "Pampers Baby Dry", arabicName: "بامبرز بيبي دراي", price: 14.95, brand: "Pampers", category: "Baby", mainCategory: "Baby", subCategory: "Diapers", imageUrl: "/sample-products/pampers.svg", productUrl: "https://yasermallonline.com/en/products/sample-pampers" },
  { englishName: "Tide Liquid Detergent", arabicName: "تايد سائل غسيل", price: 5.75, brand: "Tide", category: "Household", mainCategory: "Household", subCategory: "Laundry", imageUrl: "/sample-products/tide.svg", productUrl: "https://yasermallonline.com/en/products/sample-tide" },
  { englishName: "Lays Salt Chips", arabicName: "ليز بطاطس ملح", price: 0.45, brand: "Lays", category: "Food", mainCategory: "Food", subCategory: "Snacks", imageUrl: "/sample-products/lays.svg", productUrl: "https://yasermallonline.com/en/products/sample-lays" },
  { englishName: "Pepsi Can 330ml", arabicName: "بيبسي علبة 330 مل", price: 0.35, brand: "Pepsi", category: "Drinks", mainCategory: "Drinks", subCategory: "Soft Drinks", imageUrl: "/sample-products/pepsi.svg", productUrl: "https://yasermallonline.com/en/products/sample-pepsi" },
  { englishName: "Yaser Basmati Rice 5kg", arabicName: "ياسر أرز بسمتي 5 كيلو", price: 7.95, brand: "Yaser", category: "Food", mainCategory: "Food", subCategory: "Rice & Grains", imageUrl: "/sample-products/rice.svg", productUrl: "https://yasermallonline.com/en/products/sample-rice" },
  { englishName: "Nova Water 24 x 330ml", arabicName: "نوفا مياه 24 حبة", price: 2.75, brand: "Nova", category: "Drinks", mainCategory: "Drinks", subCategory: "Water", imageUrl: "/sample-products/water.svg", productUrl: "https://yasermallonline.com/en/products/sample-water" },
  { englishName: "Nescafe Classic Coffee", arabicName: "نسكافيه قهوة كلاسيك", price: 4.95, brand: "Nescafe", category: "Food", mainCategory: "Food", subCategory: "Coffee & Tea", imageUrl: "/sample-products/coffee.svg", productUrl: "https://yasermallonline.com/en/products/sample-coffee" },
  { englishName: "Lux Beauty Soap", arabicName: "لوكس صابون جمال", price: 1.25, brand: "Lux", category: "Personal Care", mainCategory: "Personal Care", subCategory: "Soap & Shower", imageUrl: "/sample-products/soap.svg", productUrl: "https://yasermallonline.com/en/products/sample-soap" }
];

async function main() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    const { password, ...userData } = user;
    await prisma.user.upsert({
      where: { email: user.email },
      update: { ...userData, passwordHash },
      create: { ...userData, passwordHash }
    });
  }
  for (const product of products) {
    await prisma.product.upsert({ where: { productUrl: product.productUrl }, update: product, create: product });
  }
  const catalog = await syncCatalogToDatabase({ mode: "newOnly" });
  console.log("Ready app seeded:", users.length, "users and", products.length, "starter products,", catalog.saved, "catalog rows checked");
}

main().finally(() => prisma.$disconnect());
