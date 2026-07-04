import crypto from "node:crypto";
import { chromium, type Page } from "playwright";
import { prisma } from "./prisma";

const HOME = "https://yasermallonline.com/en/home";
const ORIGIN = new URL(HOME).origin;
const BLOCKED_LINK_PARTS = ["/cart", "/checkout", "/login", "/account", "whatsapp", "mailto:", "tel:"];

function normalizeUrl(href: string) {
  return new URL(href, ORIGIN).toString().split("#")[0];
}

function isSameSite(url: string) {
  try { return new URL(url).hostname.endsWith("yasermallonline.com"); } catch { return false; }
}

function isUsefulLink(url: string) {
  const lower = url.toLowerCase();
  return isSameSite(url) && !BLOCKED_LINK_PARTS.some((part) => lower.includes(part));
}

function looksLikeProduct(url: string) {
  return /product|products|item|sku/i.test(url) && !/category|categories|collections|collection|brand/i.test(url);
}

function looksLikeCategory(url: string) {
  return /category|categories|collections|collection|brand|products/i.test(url) && !looksLikeProduct(url);
}

function priceNumber(text: string | null | undefined) {
  const n = (text ?? "").replace(/[^0-9.]/g, "");
  return n ? Number(n) : 0;
}

async function pageLinks(page: Page) {
  const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
  return Array.from(new Set(hrefs.map(normalizeUrl).filter(isUsefulLink)));
}

async function firstText(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const value = await page.locator(selector).first().textContent().catch(() => null);
    if (value?.trim()) return value.trim();
  }
  return null;
}

async function firstAttr(page: Page, selectors: string[], attr: string) {
  for (const selector of selectors) {
    const value = await page.locator(selector).first().getAttribute(attr).catch(() => null);
    if (value?.trim()) return value.trim();
  }
  return null;
}

async function scrollListing(page: Page) {
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel(0, 1800).catch(() => null);
    await page.waitForTimeout(700);
  }
}

async function extractProduct(page: Page, url: string, category: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  const englishName = await firstText(page, ["h1", "[itemprop=name]", ".product-title", ".product__title", ".title"]);
  if (!englishName) return null;
  const arabicName = await firstText(page, ["[dir=rtl] h1", ".arabic-name", ".name-ar", ".product-name-ar"]);
  const price = priceNumber(await firstText(page, ["[itemprop=price]", ".price", ".product-price", ".amount", "[class*=price]"]));
  const imageRaw = await firstAttr(page, ["meta[property='og:image']"], "content") ?? await firstAttr(page, [".product-image img", ".product__media img", "img"], "src");
  const brand = await firstText(page, ["[itemprop=brand]", ".brand", ".product-brand", "[class*=brand]"]);
  const imageUrl = imageRaw ? normalizeUrl(imageRaw) : null;
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify({ englishName, arabicName, price, imageUrl, brand, category, url })).digest("hex");
  return { englishName, arabicName, price, imageUrl, brand, category, productUrl: url, sourceHash };
}

export async function syncYaserMallLiveProducts(options: { maxProducts?: number } = {}) {
  const maxProducts = options.maxProducts ?? Number(process.env.SCRAPER_MAX_PRODUCTS ?? 120);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist") || message.includes("playwright install")) {
      return { saved: 0, productNames: [], warning: "Playwright browser is missing. Run: npx playwright install chromium" };
    }
    return { saved: 0, productNames: [], warning: message };
  }
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const saved: string[] = [];
  try {
    await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 });
    await scrollListing(page);
    const homeLinks = await pageLinks(page);
    const categoryUrls = homeLinks.filter(looksLikeCategory).slice(0, 80);
    const productQueue = new Map<string, string>();
    for (const url of homeLinks.filter(looksLikeProduct)) productQueue.set(url, "Home");
    for (const categoryUrl of categoryUrls) {
      if (productQueue.size >= maxProducts) break;
      await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
      await scrollListing(page);
      const category = await firstText(page, ["h1", ".category-title", ".collection-title", "title"]) ?? categoryUrl.split("/").filter(Boolean).pop() ?? "Uncategorized";
      for (const productUrl of (await pageLinks(page)).filter(looksLikeProduct)) {
        if (productQueue.size >= maxProducts) break;
        productQueue.set(productUrl, category);
      }
    }
    for (const [productUrl, category] of productQueue) {
      const product = await extractProduct(page, productUrl, category).catch(() => null);
      if (!product) continue;
      await prisma.product.upsert({ where: { productUrl: product.productUrl }, update: product, create: product });
      saved.push(product.englishName);
      if (saved.length >= maxProducts) break;
    }
    return { saved: saved.length, productNames: saved };
  } finally {
    await browser.close();
  }
}
