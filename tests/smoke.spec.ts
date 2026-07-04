import { test, expect } from "@playwright/test";
test("login screen loads", async ({ page }) => { await page.goto("/"); await expect(page.getByText("Yaser Mall Stock")).toBeVisible(); });
