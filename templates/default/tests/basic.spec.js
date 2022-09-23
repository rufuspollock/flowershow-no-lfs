const { test, expect } = require("@playwright/test");

/* First pass on test setup */

test("Basic test", async ({ page }) => {
  // Start from the index page
  await page.goto("/");
  // The page should exist
  expect(page.url());

  const link = page.locator("h1");
  await expect(link).toHaveText("Hello Flowershow");
});
