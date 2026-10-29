import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL("../fixtures/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
const board = read("delijn-board"),
  trip = read("delijn-trip");
test("De Lijn search, line filter and specific trip details work end to end", async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date(board.serverDateTime) });
  await page.route("https://api.irail.be/v1/stations?*", (r) =>
    r.fulfill({ json: read("stations") }),
  );
  await page.route("**/data/delijn-stops.json", (r) =>
    r.fulfill({
      json: {
        stops: [
          ["101026", "Wilrijk Klaproosstraat", 51.17, 4.407, "Antwerpen"],
        ],
      },
    }),
  );
  await page.route("**/api/delijn/departures/101026", (r) =>
    r.fulfill({ json: board }),
  );
  await page.route("**/api/delijn/trip/*", (r) => r.fulfill({ json: trip }));
  await page.route("**/api/delijn/pattern/*", r => r.fulfill({ json: read("delijn-pattern") }));
  await page.goto("/");
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobiele navigatie" : "Hoofdnavigatie",
    exact: true,
  });
  await nav.getByRole("button", { name: "Ontdekken", exact: true }).click();
  await page.getByRole("button", { name: "De Lijn", exact: true }).click();
  await page
    .getByLabel("Zoek een halte of station", { exact: true })
    .fill("101026");
  await page
    .getByRole("option", {
      name: "Wilrijk Klaproosstraat De Lijn · 101026",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Filter op lijn")).toBeVisible();
  await page.getByLabel("Filter op lijn").selectOption("22");
  await expect(page.locator(".departure").first()).toContainText("Edegem UZA");
  await page.locator(".departure").first().click();
  await expect(page.getByRole("heading", { name: "Mijn lijn." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "22", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".trip-stops")).toContainText(
    "Antwerpen Groenplaats",
  );
  await expect(
    page.getByText("Geen live GPS-positie beschikbaar", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Verbinding verbreken" }).click();
  await expect(
    page.getByRole("heading", { name: "Met welke lijn reis je mee?" }),
  ).toBeVisible();
});
