import { test, expect } from "@playwright/test";

const origin = process.env.FERRUM_TEST_URL ?? "http://127.0.0.1:3000";
test.use({
  launchOptions: { executablePath: process.env.FERRUM_CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" },
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
test.setTimeout(90000);

async function skipPastIntro(page) {
  await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
}
const menu = page => page.getByRole("button", { name: "Toggle module navigation" });

test("the artifact stays in view after rotation and swiping opens the research site", async ({ page }) => {
  await page.goto(origin);
  const entrance = page.locator(".cinematic-entrance");
  await expect(entrance).toBeVisible();
  await expect(entrance.locator("canvas")).toHaveCount(0);
  await expect(entrance.locator(".entrance-mineral-still")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  for (const selector of [".entrance-topline button", ".entrance-scroll-cue button", ".entrance-footnote"]) {
    await expect(entrance.locator(selector)).toBeInViewport({ ratio: 1 });
  }
  const touch = await page.context().newCDPSession(page);
  for (let swipe = 0; swipe < 8 && await entrance.isVisible(); swipe++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 422, y: 330 }] });
    for (const y of [280, 210, 140, 60]) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 422, y }] });
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await expect(entrance).toHaveCount(0, { timeout: 15000 });
  await expect(menu(page)).toBeInViewport();
});

test("touch entrance, search dismissal and module navigation", async ({ page }) => {
  await page.goto(origin);
  const entrance = page.locator(".cinematic-entrance");
  await expect(entrance).toBeVisible();
  await entrance.getByRole("button", { name: "Scroll to enter" }).tap();
  await expect(entrance).toHaveCount(0, { timeout: 15000 });
  await menu(page).tap();
  await expect(page.locator(".module-nav.open")).toBeVisible();
  await page.touchscreen.tap(10, 530);
  await expect(menu(page)).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Open command search" }).tap();
  await page.getByRole("button", { name: "Close search" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu(page).tap();
  await page.getByRole("link", { name: "Rankings", exact: true }).tap();
  await expect(page).toHaveURL(origin + "/rankings");
  await menu(page).tap();
  await page.getByRole("link", { name: "Companies", exact: true }).tap();
  await expect(page).toHaveURL(origin + "/#company-universe");
  await expect(page.getByRole("textbox", { name: "Filter companies" })).toBeInViewport();
});

test("compare selections carry across routes and all four market charts zoom independently", async ({ page }) => {
  await skipPastIntro(page);
  await page.goto(origin + "/compare");
  const checks = page.getByRole("checkbox", { name: /^Select .* for comparison$/ });
  await expect(page.locator(".compare-table-wrap")).toHaveCount(0);
  await checks.nth(0).tap();
  await checks.nth(1).tap();
  await checks.nth(2).tap();
  await expect(checks.nth(3)).toBeDisabled();
  await checks.nth(2).tap();
  await expect(page.locator(".selected-company-charts .evidence-plot")).toHaveCount(7);
  await page.getByRole("link", { name: "Compare selected" }).tap();
  const measure = page.getByLabel("Compare a measure");
  const value = page.locator(".compact-comparison dd").first();
  const firstScore = await value.textContent();
  await measure.selectOption({ label: "Risk flags" });
  await expect(value).not.toHaveText(firstScore);
  await page.getByRole("link", { name: "Technical chapter" }).first().tap();
  await expect(page).toHaveURL(/\/companies\/C\d+#company-technical$/);
  await page.locator(".company-chapter-menu summary").tap();
  await expect(page.getByRole("navigation", { name: "Company chapters" }).getByRole("link", { name: "Sources" })).toBeVisible();
  await page.locator(".company-chapter-menu summary").tap();
  const sliders = page.locator(".technical-zoom input");
  await expect(sliders).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const slider = sliders.nth(index);
    await slider.scrollIntoViewIfNeeded();
    await slider.tap({ position: { x: 68, y: 21 } });
    await expect(slider).not.toHaveValue("0");
    if (index < 3) await expect(sliders.nth(index + 1)).toHaveValue("0");
  }
  await expect(page.locator(".company-market-evidence .evidence-plot").first()).toBeVisible();
  await expect(page.locator('[aria-label="Company-specific financial charts"] .evidence-plot').first()).toBeVisible();
  const group = page.locator(".source-archive-group").first();
  await group.locator(":scope > summary").tap();
  await group.locator(".data-sheet > summary").first().tap();
  await expect(group.locator(".compact-record dl").first()).toBeVisible();
  await expect(group.locator(".data-sheet-scroll table")).toHaveCount(0);
  await group.getByRole("button", { name: "Source details" }).first().tap();
  await page.getByRole("button", { name: "Close source details" }).tap();
  await page.goBack();
  await expect(page.locator(".selected-company-charts .evidence-plot")).toHaveCount(7);
});

test("company sorting, search, and the heatmap fit at 320px", async ({ page }) => {
  await skipPastIntro(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(origin + "/compare");
  const cards = page.locator(".compact-companies > li");
  await expect(cards).toHaveCount(20);
  await page.getByLabel("Sort by").selectOption("name");
  const first = await cards.first().textContent();
  await page.getByRole("button", { name: /Change sort order/ }).tap();
  await expect(cards.first()).not.toHaveText(first);
  await page.getByRole("textbox", { name: "Search" }).fill("not-a-company");
  await expect(page.getByRole("status")).toHaveText("No companies match the current filters.");
  await page.getByRole("textbox", { name: "Search" }).clear();
  await page.getByRole("button", { name: "Scatter" }).tap();
  await page.locator(".compare-dot").first().press("Enter");
  await expect(page.locator(".comparison-chart .mobile-scatter-reading")).toBeVisible();
  await expect(page).toHaveURL(origin + "/compare");
  await page.getByRole("button", { name: "Heatmap" }).tap();
  const heatmap = page.locator(".score-heatmap-wrap");
  await expect(heatmap.locator("tbody tr")).toHaveCount(20);
  expect(await heatmap.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await heatmap.getByRole("checkbox", { name: "Growth", exact: true }).uncheck();
  await expect(heatmap.getByRole("columnheader", { name: "Growth", exact: true })).toHaveCount(0);
});

for (const width of [320, 430, 768]) test("research modules fit a " + width + "px viewport", async ({ page }) => {
  await skipPastIntro(page);
  await page.setViewportSize({ width, height: width === 768 ? 600 : 850 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [route, selector] of [["/",".hero-data"],["/sector",".story-sections"],["/rankings",".ranking-columns"],["/compare",".comparison-controls"],["/methodology",".source-inventory"],["/intelligence",".intel-controls"],["/companies/C20",".technical-zoom"]]) {
    await page.goto(origin + route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(selector).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (route === "/intelligence") {
      await page.locator(".intel-hub-controls select").selectOption("C20");
      await page.getByRole("button", { name: /Workbook only/ }).tap();
      await expect(page.getByRole("button", { name: "Generate research brief" })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});
