import { expect, test } from "@playwright/test";

test("navigates to Genesis 1:1 and renders verse text", async ({ page }) => {
  await page.goto("/verse");

  await expect(page.getByTestId("book-select")).toBeVisible();

  await page.getByTestId("book-select").selectOption("Genesis");
  await page.getByTestId("chapter-select").selectOption("1");
  await page.getByTestId("verse-select").selectOption("1");

  await expect(page).toHaveURL(/\/verse\/Gen-1-1$/);
  await expect(page.getByTestId("active-ref")).toHaveText("Genesis 1:1");
  await expect(page.getByTestId("verse-text")).toContainText("בְּרֵאשִׁ");
});
