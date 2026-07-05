const baseUrl = process.env.APP_URL || "https://yaser-mall-stock.onrender.com";
const secret = process.env.CRON_SECRET || "";
const url = new URL("/api/cron/nightly-sync", baseUrl);
if (secret) url.searchParams.set("secret", secret);

const response = await fetch(url, { method: "POST", headers: { accept: "application/json" } });
const text = await response.text();
console.log(text);

if (!response.ok) {
  process.exitCode = 1;
}
