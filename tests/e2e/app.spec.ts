import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const stations = JSON.parse(
  readFileSync(new URL("../fixtures/stations.json", import.meta.url), "utf8"),
);
test.beforeEach(async ({ page }) => {
  await page.route("**/data/delijn-stops.json",r=>r.fulfill({json:{stops:[]}}));
  await page.route("https://api.irail.be/v1/stations?*", (r) =>
    r.fulfill({ json: stations }),
  );
  await page.route("https://api.irail.be/v1/liveboard?*", (r) =>
    r.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
});
test("all navigation pages and local favorites survive restart", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Goed op weg." }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobiele navigatie" : "Hoofdnavigatie",
    exact: true,
  });
  for (const label of ["Routes", "Ontdekken", "Live", "Profiel"]) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.getByLabel("Weergavenaam").fill("Reiziger");
  await page.getByLabel("Voeg een favoriet toe").fill("Aalst");
  await page
    .getByRole("option", { name: "Aalst NMBS · 008895000", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aalst", exact: true }),
  ).toBeVisible();
  await page.reload();
  await nav.getByRole("button", { name: "Profiel", exact: true }).click();
  await expect(page.getByLabel("Weergavenaam")).toHaveValue("Reiziger");
  await expect(
    page.getByRole("button", { name: "Aalst", exact: true }),
  ).toBeVisible();
});
test("manual location produces five cards and handles provider failure without a blank screen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Liever zelf een gebied kiezen" })
    .click();
  await page.getByLabel("Of kies een station").fill("Aalst");
  await page
    .getByRole("option", { name: "Aalst NMBS · 008895000", exact: true })
    .click();
  await expect(page.locator(".stop-list .stop-card")).toHaveCount(5);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".stop-list .error").first()).toBeVisible({
    timeout: 20000,
  });
});
test("no horizontal overflow at target viewport", async ({ page }) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
