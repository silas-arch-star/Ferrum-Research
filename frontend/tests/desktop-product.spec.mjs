import { test, expect } from "@playwright/test";

const origin = process.env.FERRUM_TEST_URL ?? "http://127.0.0.1:3000";
test.use({ launchOptions: { executablePath: process.env.FERRUM_CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" }, viewport: { width: 1440, height: 1000 } });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  // These are application regressions; the first-visit artifact has its own suite.
  await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
});

const routes = [
  ["Home", "/", ".hero-data"], ["Sector", "/sector", ".story-sections"],
  ["Compare", "/compare", ".comparison-controls"], ["Rankings", "/rankings", ".ranking-columns"],
  ["Methodology", "/methodology", ".source-inventory details"],
  ["Intelligence", "/intelligence", ".intel-controls"],
  ["Company", "/companies/C01", ".company-context"],
];

for (const width of [1101, 1440, 1920]) {
  test.describe(`${width}px desktop`, () => {
    test.use({ viewport: { width, height: 1000 } });
    for (const [name, path, ready] of routes) test(`${name}: readable, contained and immediately available`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(origin + path);
      await expect(page.locator(ready).first()).toBeVisible();
      await expect(page.locator(".cinematic-entrance")).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      const layout = await page.evaluate(() => {
        const header = document.querySelector(".topbar"), nav = document.querySelector(".module-nav");
        return { width: document.documentElement.scrollWidth, viewport: innerWidth, background: getComputedStyle(header).backgroundColor,
          font: getComputedStyle(document.body).fontFamily, navWidth: nav.clientWidth, navScroll: nav.scrollWidth };
      });
      expect(layout.width).toBeLessThanOrEqual(layout.viewport);
      expect(layout.navScroll).toBeLessThanOrEqual(layout.navWidth + 1);
      expect(layout.font.toLowerCase()).toContain("manrope");
      expect(layout.background).toBe("rgb(17, 23, 25)");
      if (name === "Compare") expect(await page.locator(".compare-table-wrap").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      if (name === "Sector") await expect(page.locator(".sector-chapter-nav-mobile")).toBeHidden();
      if (name === "Home") {
        const color = await page.locator(".hero-explore").evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
        expect(color.bg).toBe("rgb(165, 210, 198)");
        expect(color.fg).toBe("rgb(19, 43, 39)");
      }
      expect(errors).toEqual([]);
    });
  });
}

test("Companies navigation resolves its destination after route data loads", async ({ page }) => {
  await page.goto(origin + "/rankings");
  await page.getByRole("link", { name: "Companies", exact: true }).click();
  await expect(page).toHaveURL(origin + "/#company-universe");
  await expect.poll(() => page.locator("#company-universe").evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
  await expect.poll(() => page.locator("#company-universe").evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThanOrEqual(120);
  await page.locator(".universe-search input").fill("Tata");
  await expect(page.locator(".universe-table tbody tr")).toHaveCount(1);
  await page.locator(".table-company").click();
  await expect(page.locator(".company-context h2")).toContainText("Tata Steel");
});

test("command search supports keyboard selection and Escape", async ({ page }) => {
  await page.goto(origin);
  await expect(page.locator(".hero-data")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.locator("[cmdk-input]")).toBeFocused();
  await page.locator("[cmdk-input]").fill("Tata");
  await page.keyboard.press("Enter");
  await expect(page.locator(".company-context h2")).toContainText("Tata Steel");
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(page.locator(".command-box")).toHaveCount(0);
});

test("clicking the search backdrop dismisses the panel", async ({ page }) => {
  await page.goto(origin);
  const trigger = page.getByRole("button", { name: "Open command search" });
  await trigger.click();
  const input = page.locator("[cmdk-input]");
  await input.fill("Tata");
  await input.click();
  await expect(page.locator(".command-box")).toBeVisible();
  await page.locator(".command-dialog").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".command-box")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("comparison filters, ordering, selections and all four views work", async ({ page }) => {
  await page.goto(origin + "/compare");
  await expect(page.locator(".universe-table tbody tr")).toHaveCount(20);
  await page.locator(".comparison-controls input").fill("Tata");
  await expect(page.locator(".universe-table tbody tr")).toHaveCount(1);
  await page.locator(".comparison-controls input").fill("");
  await page.locator(".company-check input").nth(0).check();
  await page.locator(".company-check input").nth(1).check();
  await expect(page.locator(".side-by-side tbody tr").first().locator("td")).toHaveCount(2);
  await expect(page.locator(".selected-company-charts .evidence-plot")).toHaveCount(7, { timeout: 15000 });
  await expect(page.locator(".selected-company-charts .recharts-surface").first()).toBeVisible();
  await page.locator(".selected-company-charts").getByLabel("Financial metric").selectOption({ label: "ROCE" });
  await expect(page.getByRole("heading", { name: "ROCE over time" })).toBeVisible();
  await page.locator(".comparison-controls input").fill("Tata");
  await expect(page.locator(".side-by-side tbody tr").first().locator("td")).toHaveCount(2);
  await page.locator(".comparison-controls input").clear();
  await page.getByRole("button", { name: "Fundamental score", exact: true }).click();
  const values = await page.locator(".universe-table tbody td:nth-child(3)").allTextContents();
  expect(Number(values[0])).toBeGreaterThanOrEqual(Number(values[1]));
  await page.getByRole("button", { name: "Scatter", exact: true }).click();
  await expect(page.locator(".compare-dot")).toHaveCount(20);
  await page.locator(".compare-dot").first().focus();
  await expect(page.getByRole("tooltip")).toContainText("Fundamental score");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("button", { name: "Rank bars", exact: true }).click();
  await expect(page.locator(".rank-bar-row")).toHaveCount(20);
  await page.getByRole("button", { name: "Heatmap", exact: true }).click();
  await expect(page.locator(".score-heatmap tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.locator(".company-check input:checked")).toHaveCount(2);
});

test("ranking categories change the selected company", async ({ page }) => {
  await page.goto(origin + "/rankings");
  await page.getByRole("tab", { name: "Momentum", exact: true }).click();
  await expect(page.locator(".recommendation-result h2")).toContainText("Shyam");
  await page.getByRole("tab", { name: "Overall Best Investment", exact: true }).click();
  await expect(page.locator(".recommendation-result h2")).toContainText("National Aluminium");
});

test("desktop comparison selection follows company navigation and reloads", async ({ page }) => {
  await page.goto(origin + "/compare");
  await page.locator(".company-check input").first().check();
  await page.locator(".compare-table-wrap .text-action").first().click();
  await expect(page.locator(".company-context button")).toHaveText("Remove from comparison");
  await page.locator(".company-context button").click();
  await expect(page.locator(".company-context button")).toHaveText("Add to comparison");
  await page.locator(".company-context button").click();
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await expect(page).toHaveURL(origin + "/compare");
  await expect(page.locator(".comparison-page")).toBeVisible();
  await expect(page.locator(".company-check input:checked")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".company-check input:checked")).toHaveCount(1);
});

test("company history restores the company and its section navigation", async ({ page }) => {
  await page.goto(origin + "/companies/C01");
  await expect(page.locator(".company-context:visible h2")).toContainText("JSW Steel");
  await page.keyboard.press("Control+k");
  await page.locator("[cmdk-input]").fill("Tata");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(origin + "/companies/C02");
  await expect(page.locator(".company-context:visible h2")).toContainText("Tata Steel");
  await page.goBack();
  await expect(page).toHaveURL(origin + "/companies/C01");
  await expect(page.locator(".company-context:visible h2")).toContainText("JSW Steel");
  const technical = page.locator(".context-strip:visible a[href='#company-technical']");
  await technical.click();
  await expect(technical).toHaveAttribute("aria-current", "location");
  await expect.poll(() => page.locator("main.app-shell:visible #company-technical").evaluate(node => node.getBoundingClientRect().top)).toBeLessThanOrEqual(170);
});

test("company research charts, section navigation and source disclosures work", async ({ page }) => {
  await page.goto(origin + "/companies/C01");
  await expect(page.locator(".visual-kpi")).toHaveCount(4);
  await page.locator(".context-strip a[href='#company-technical']").click();
  await expect(page.locator(".context-strip a[href='#company-technical']")).toHaveAttribute("aria-current", "location");
  await page.getByRole("button", { name: "1M", exact: true }).click();
  await expect(page.getByRole("button", { name: "1M", exact: true })).toHaveClass("active");
  await expect(page.locator(".technical-chart .recharts-surface").first()).toBeVisible();
  await page.locator(".context-strip a[href='#company-fundamental']").click();
  await expect(page.locator("#company-fundamental .company-evidence .evidence-plot")).toHaveCount(4);
  await expect(page.locator("#company-technical .company-market-evidence .evidence-plot")).toHaveCount(2);
  await expect(page.locator(".technical-chart .plot-legend")).toHaveCount(4);
  await expect(page.locator("#company-fundamental .visual-chart-card .plot-legend")).toHaveCount(6);
  await expect(page.locator(".company-market-evidence .plot-legend")).toHaveCount(2);
  const sma = page.getByRole("checkbox", { name: "20-day SMA" });
  await sma.uncheck();
  await expect(page.locator(".technical-chart .plot-legend").first()).not.toContainText("20-day SMA");
  await sma.check();
  await expect(page.locator(".technical-chart .plot-legend").first()).toContainText("20-day SMA");
  const trend = page.locator("#company-fundamental .visual-chart-card").first();
  await trend.locator("select").selectOption({ label: "ROCE" });
  await expect(trend.locator(".plot-legend")).toHaveText("ROCE");
  for (const selector of ["#company-integrated > .analyst-note", "#company-integrated > .risk-detail"]) {
    const unusedWidth = await page.locator(selector).evaluate(node => node.parentElement.clientWidth - node.offsetWidth);
    expect(unusedWidth).toBeLessThanOrEqual(2);
  }
  await expect(page.locator("#company-fundamental .data-sheet")).toHaveCount(0);
  await page.locator(".context-strip a[href='#company-sources']").click();
  const archive = page.locator("#company-sources .source-archive-group").first();
  await archive.locator(":scope > summary").click();
  const summary = archive.locator(".data-sheet summary").first();
  await summary.click();
  await expect(archive.locator(".data-sheet[open]").first()).toBeVisible();
  await expect(page.locator("#company-sources")).not.toContainText("01_Company_Master");
});

test("each technical zoom slider independently narrows the plotted sessions", async ({ page }) => {
  await page.goto(origin + "/companies/C01");
  const sliders = page.locator("#company-technical").getByRole("slider", { name: /zoom$/i });
  await expect(sliders).toHaveCount(4);
  for (const [index, slider] of (await sliders.all()).entries()) {
    const stroke = page.locator(".technical-chart").nth(index).locator(".recharts-line-curve").first();
    const fullPath = await stroke.getAttribute("d");
    expect(fullPath).toBeTruthy();
    await slider.press("End");
    await expect(slider).toHaveAttribute("aria-valuetext", /^10 trading sessions/);
    await expect(stroke).not.toHaveAttribute("d", fullPath);
    await expect(page.locator("#company-technical input[type=range][value='100']")).toHaveCount(1);
    await slider.press("Home");
    await expect(slider).toHaveAttribute("aria-valuetext", /^[1-9]\d{2,} trading sessions/);
  }
  await sliders.first().press("End");
  await page.getByRole("button", { name: "1M", exact: true }).click();
  await expect(sliders.first()).toHaveValue("0");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(sliders.first()).toHaveValue("0");
});

test("methodology source inventory and sector chapter navigation work", async ({ page }) => {
  await page.goto(origin + "/methodology");
  const disclosure = page.locator(".source-inventory details").first();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await page.getByRole("link", { name: "Sector Research", exact: true }).click();
  const chapters = page.locator(".sector-aside .sector-chapter-nav button");
  await chapters.nth(2).click();
  await expect(chapters.nth(2)).toHaveClass("active");
});

test("intelligence company selection updates the research context without a provider call", async ({ page }) => {
  const writes = [];
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.goto(origin + "/intelligence");
  await page.locator(".intel-hub-controls select").selectOption("C02");
  await page.locator(".intel-hub-controls > button").click();
  await expect(page).toHaveURL(origin + "/companies/C02");
  expect(writes).toEqual([]);
});

test("desktop data failures provide an actionable recovery state", async ({ page }) => {
  await page.route("**/api/v1/companies", route => route.abort());
  await page.goto(origin);
  await expect(page.getByText("RESEARCH TEMPORARILY UNAVAILABLE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.locator(".state-panel")).not.toContainText("FastAPI");
});
