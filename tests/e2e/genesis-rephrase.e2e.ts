import { expect, test } from "@playwright/test";

test("clicking a genesis paraphrase anchor opens evidence with matching word trace", async ({
  page
}) => {
  await page.goto("/rephrase?chapter=1");

  await expect(page.getByTestId("genesis-rephrase-page")).toBeVisible();
  await expect(page.getByTestId("genesis-rephrase-strict")).toBeVisible();

  await page.getByTestId("rephrase-anchor-g1_1_opening").click();

  await expect(page.getByTestId("anchor-evidence-panel")).toBeVisible();
  await expect(page.getByTestId("anchor-evidence-anchor-id")).toHaveText("g1_1_opening");
  await expect(page.getByTestId("anchor-evidence-word-surface-Genesis-1-1-1-1")).toHaveText(
    "בְּרֵאשִׁית"
  );
  await expect(page.getByTestId("anchor-evidence-trace-event-Genesis-1-1-1-2-0")).toContainText(
    "RESH.BOUNDARY_CLOSE"
  );
});
