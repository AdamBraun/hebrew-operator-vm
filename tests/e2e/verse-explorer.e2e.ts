import { expect, test } from "@playwright/test";

test("navigates to Genesis 1:1 and renders verse text", async ({ page }) => {
  await page.goto("/verse");

  await expect(page.getByTestId("book-select")).toBeVisible();

  await page.getByTestId("book-select").selectOption("Genesis");
  await page.getByTestId("chapter-select").selectOption("1");
  await page.getByTestId("verse-select").selectOption("1");

  await expect(page).toHaveURL(/\/verse\/Gen-1-1(?:\?.*)?$/);
  await expect(page.getByTestId("active-ref")).toHaveText("Genesis 1:1");
  await expect(page.getByTestId("verse-text")).toContainText("בְּרֵאשִׁ");
});

test("clicking a phrase tree node highlights the corresponding words", async ({ page }) => {
  await page.goto("/verse/Gen-1-1");

  await expect(page.getByTestId("phrase-tree")).toBeVisible();

  await page.getByTestId("phrase-node-n_4_5_join").click();

  await expect(page.getByTestId("verse-word-4")).toHaveAttribute("data-highlighted", "true");
  await expect(page.getByTestId("verse-word-5")).toHaveAttribute("data-highlighted", "true");
  await expect(page.getByTestId("verse-word-3")).toHaveAttribute("data-highlighted", "false");
});

test("trace viewer filters atomic events for selected word", async ({ page }) => {
  await page.goto("/trace?ref=Exodus%2F2%2F12&word=1");

  const traceViewer = page.getByTestId("trace-viewer");
  await expect(traceViewer).toBeVisible();
  const resultsCount = page.getByTestId("trace-results-count");
  await expect(resultsCount).toContainText(/Showing \d+ of \d+ events\./);

  const rowsBefore = await page.locator('[data-testid^="trace-event-row-"]').count();
  expect(rowsBefore).toBeGreaterThan(1);

  await page.getByTestId("trace-filter-search").fill("DISCHARGE(SUPPORT)");
  const rowsAfter = await page.locator('[data-testid^="trace-event-row-"]').count();
  expect(rowsAfter).toBeLessThan(rowsBefore);
  await expect(resultsCount).toContainText(/Showing \d+ of \d+ events\./);
});
