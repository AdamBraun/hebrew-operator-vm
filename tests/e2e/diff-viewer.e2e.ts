import { expect, test } from "@playwright/test";

test("selects two bundles and renders verse-level semantic diff evidence", async ({ page }) => {
  await page.goto("/diff");

  await expect(page.getByTestId("diff-viewer-page")).toBeVisible();

  await page.getByTestId("diff-bundle-a-select").selectOption("diff-a");
  await page.getByTestId("diff-bundle-b-select").selectOption("diff-b");

  await expect(page.getByTestId("diff-blast-radius")).toContainText("Changed 1 of 2 verses");

  const changedVerseButton = page.getByTestId("diff-changed-verse-Genesis-1-1");
  await expect(changedVerseButton).toBeVisible();
  await changedVerseButton.click();

  await expect(page.getByTestId("diff-selected-verse")).toHaveText("Genesis 1:1");
  await expect(page.getByTestId("diff-paraphrase-strict")).toContainText(
    "In beginning, form was spoken"
  );
  await expect(page.getByTestId("diff-paraphrase-strict")).toContainText(
    "At first light, form emerged"
  );
  await expect(page.getByTestId("diff-ledger-impact")).toContainText(
    "Added: trace:Genesis/1/1/1#e0-1"
  );
  await expect(page.getByTestId("diff-skeleton-word-1")).toContainText("HE.DECLARE");
  await expect(page.getByTestId("diff-skeleton-word-1")).toContainText("MEM.OPEN");
});
