import { expect, test } from "@playwright/test";

test("pattern search query jumps to verse and highlights selected word", async ({ page }) => {
  await page.goto("/pattern");

  await expect(page.getByTestId("pattern-search-page")).toBeVisible();

  await page.getByTestId("pattern-mode-select").selectOption("motif");
  await page.getByTestId("pattern-value-motif").selectOption("ENDS_WITH_FINALIZE");
  await page.getByTestId("pattern-limit-input").fill("10");
  await page.getByTestId("pattern-search-submit").click();

  await expect(page.getByTestId("pattern-summary")).toContainText("matched");
  const firstResultLink = page.getByTestId("pattern-result-link-0");
  await expect(firstResultLink).toBeVisible();

  const targetRef = await firstResultLink.getAttribute("data-target-ref");
  const targetWord = await firstResultLink.getAttribute("data-target-word");
  if (!targetRef || !targetWord) {
    throw new Error("Missing target reference metadata on pattern result link");
  }

  await firstResultLink.click();

  const parts = targetRef.split("/");
  const verse = parts.pop();
  const chapter = parts.pop();
  const book = parts.join("/");

  await expect(page.getByTestId("active-ref")).toHaveText(`${book} ${chapter}:${verse}`);
  await expect(page.getByTestId(`verse-word-${targetWord}`)).toHaveAttribute(
    "data-highlighted",
    "true"
  );
  await expect(page.getByTestId(`verse-word-${targetWord}`)).toHaveClass(/is-active/);
});
