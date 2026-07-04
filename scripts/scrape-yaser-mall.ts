import { syncYaserMallLiveProducts } from "../lib/yaser-mall-live";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await syncYaserMallLiveProducts({ maxProducts: Number(process.env.SCRAPER_MAX_PRODUCTS ?? 300) });
  console.log(`Saved ${result.saved} live Yaser Mall products`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
