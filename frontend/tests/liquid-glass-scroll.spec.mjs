import { test, expect } from "@playwright/test";

// Run against Ferrum's production frontend and its read-only local research API:
// npx playwright test tests/liquid-glass-scroll.spec.mjs --workers=1
const origin = process.env.FERRUM_TEST_URL ?? "http://127.0.0.1:3000";
test.use({ launchOptions: {
  executablePath: process.env.FERRUM_CHROMIUM_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined),
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader"],
} });
test.setTimeout(120_000);

async function inspectGlass(page) {
  const state = await page.evaluate(() => {
    const outputs = [...document.querySelectorAll(".optical-output")];
    const sample = document.createElement("canvas"); sample.width = 32; sample.height = 16;
    const ctx = sample.getContext("2d");
    return {
      width: document.documentElement.scrollWidth, viewport: innerWidth,
      renderers: document.querySelectorAll("body > canvas").length,

      outputs: outputs.map(canvas => {
        const host = canvas.closest("[data-glass-variant]");
        ctx.clearRect(0, 0, 32, 16); ctx.drawImage(canvas, 0, 0, 32, 16);
        const data = ctx.getImageData(0, 0, 32, 16).data;
        let bright = 0;
        for (let y = 4; y < 12; y++) for (let x = 4; x < 28; x++) {
          const i = (y * 32 + x) * 4;
          if (data[i] > 150 && data[i + 1] > 150 && data[i + 2] > 150 && data[i + 3] > 180) bright++;
        }
        const tile = canvas.getBoundingClientRect();
        const hero = document.querySelector(".hero-atmosphere")?.getBoundingClientRect();
        const samplesHero = hero && tile.top < hero.bottom && tile.bottom > hero.top;
        return { width: canvas.width, height: canvas.height, tileWidth: tile.width, tileHeight: tile.height, maxHeight: innerHeight, maxWidth: innerWidth, blur: getComputedStyle(host).backdropFilter,
          bright: samplesHero ? 0 : bright, transition: getComputedStyle(canvas).transitionDuration };
      }),
    };
  });
  expect(state.width).toBeLessThanOrEqual(state.viewport + 1);
  expect(state.renderers).toBe(1);
  expect(state.outputs.length).toBeGreaterThan(0);
  for (const output of state.outputs) {
    expect(output.width).toBeLessThanOrEqual(Math.ceil(output.maxWidth * 1.25) + 2);
    expect(output.height).toBeLessThanOrEqual(Math.ceil(output.maxHeight * 1.25) + 2);
    expect(output.tileWidth).toBeLessThanOrEqual(output.maxWidth + 2);
    expect(output.tileHeight).toBeLessThanOrEqual(output.maxHeight + 2);
    expect(output.blur).toBe("none");
    expect(output.bright).toBe(0);
    expect(output.transition).toBe("0s");
  }
}

const routes = [
  ["Home", "/", ".hero-data"], ["Companies", "/", ".universe-search"],
  ["Company Research", "/companies/C01", ".company-context"], ["Sector", "/sector", ".story-sections"],
  ["Compare", "/compare", ".comparison-controls"], ["Rankings", "/rankings", ".recommendation-result"],
  ["Methodology", "/methodology", ".method-notes"], ["Intelligence", "/intelligence", ".intel-controls"],
];
// Desktop is covered by desktop-product.spec.mjs; optical material is retained below 1101px.
for (const mobile of [true]) test.describe(mobile ? "mobile DPR 3" : "desktop", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 3 : 1 });
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1")); });
  for (const [name, path, ready] of routes) test(`${name}: slow/rapid scroll and stable transparent panels`, async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(origin + path); await page.locator(ready).waitFor();
    await expect(page.locator(".topbar-inner[data-optical-ready='true']")).toBeVisible();
    const focus = page.locator(name === "Companies" ? ".universe-search" : name === "Rankings" ? ".recommendation-result" : ready).first();
    const y = await focus.evaluate(e => e.getBoundingClientRect().top + scrollY);
    for (const offset of [-180, -130, -80, -30, 20, 160, 600, 1200, 200, -120]) {
      await page.evaluate(y => window.scrollTo({ top: Math.max(0, y), behavior: "instant" }), y + offset);
      await page.mouse.move(mobile ? 190 : 900, 200 + Math.abs(offset) % 300);
      // Observe paints during motion, rather than waiting for a post-scroll settle.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await inspectGlass(page);
    }
    if (name === "Companies") {
      await page.locator(".universe-search input").fill("Tata");
      await expect(page.locator(".universe-table tbody tr")).toHaveCount(1);
    } else if (name === "Compare") {
      await page.getByRole("button", { name: "Scatter", exact: true }).click();
      await expect(page.locator(".compare-dot").first()).toBeVisible();
    } else if (name === "Rankings") {
      await page.getByRole("tab", { name: "Income", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Income", exact: true })).toHaveAttribute("aria-selected", "true");
    } else if (name === "Methodology") {
      await page.locator(".source-inventory summary").first().click();
      await expect(page.locator(".source-inventory details[open]").first()).toBeVisible();
    } else if (name === "Intelligence") {
      await page.locator(".intel-controls textarea").fill("Review source workbook evidence.");
      await expect(page.locator(".intel-controls textarea")).toHaveValue("Review source workbook evidence.");
    } else if (name === "Sector") {
      const chapters = page.locator(".story-sections > section"), count = await chapters.count();
      const exhibits = [];
      for (const index of [2, Math.floor(count / 2), count - 1]) {
        await chapters.nth(index).scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const position = await page.locator(".sticky-chart").evaluate(e => ({ position: getComputedStyle(e).position, top: e.getBoundingClientRect().top }));
        if (mobile) expect(position.position).not.toBe("sticky");
        else {
          expect(position.position).toBe("sticky"); expect(position.top).toBeGreaterThanOrEqual(87); expect(position.top).toBeLessThan(100);
          exhibits.push(await page.locator(".sector-aside .sector-visual-stage").getAttribute("aria-label"));
        }
      }
      if (!mobile) expect(new Set(exhibits).size).toBe(3);
    }
    expect(errors).toEqual([]);
  });
});

test("client navigation releases old contexts; reduced motion and no-WebGL remain usable", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => {
    sessionStorage.setItem("ferrum:entrance:seen:v1", "1"); window.__glassContexts = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const ctx = original.call(this, type, ...args);
      if (ctx && /webgl/.test(type) && !window.__glassContexts.includes(ctx)) window.__glassContexts.push(ctx);
      return ctx;
    };
  });
  const page = await context.newPage(); await page.goto(origin + "/rankings");
  await expect(page.locator(".topbar-inner .optical-output")).toBeAttached();
  const sample = () => page.locator(".topbar-inner .optical-output").evaluate(c => c.toDataURL());
  const first = await sample(); await page.waitForTimeout(350); expect(await sample()).toBe(first);
  for (const name of ["Compare", "Rankings", "Methodology", "Sector Research", "Intelligence", "Rankings"]) {
    await page.getByRole("button", { name: "Toggle module navigation" }).click();
    await page.getByRole("navigation", { name: "Research modules" }).getByRole("link", { name, exact: true }).click();
    const path = { Compare: "/compare", Rankings: "/rankings", Methodology: "/methodology", "Sector Research": "/sector", Intelligence: "/intelligence" }[name];
    await expect(page).toHaveURL(origin + path);
    await expect(page.locator(".topbar-inner .optical-output")).toBeAttached();
    expect(await page.evaluate(() => window.__glassContexts.filter(ctx => !ctx.isContextLost()).length)).toBe(1);
  }
  await context.close();
  const fallback = await browser.newContext({ reducedMotion: "reduce" });
  await fallback.addInitScript(() => {
    sessionStorage.setItem("ferrum:entrance:seen:v1", "1");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  const plain = await fallback.newPage(); await plain.goto(origin + "/methodology");
  await expect(plain.locator(".method-notes")).toBeVisible();
  await expect(plain.locator("body > canvas")).toHaveCount(0);
  await plain.locator(".source-inventory summary").first().click();
  await expect(plain.locator(".source-inventory details[open]").first()).toBeVisible();
  await fallback.close();
});

for (const width of [390]) test(`${width}px: full-size partial lenses, spacing, animation and resize`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width === 390 ? 3 : 1 });
  await context.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
  const page = await context.newPage(); await page.goto(origin + "/rankings");
  const card = page.locator(".recommendation-result"); await card.waitFor();
  await page.locator(".recommendation-detail summary").click();
  const top = await card.evaluate(e => e.getBoundingClientRect().top + scrollY);
  // Reproduce the old recommendation failure: cross BOTH viewport boundaries.
  for (const offset of [-780, -260, 40, 140, -100]) {
    await page.evaluate(y => scrollTo({ top: Math.max(0, y), behavior: "instant" }), top + offset);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(card.locator(":scope > .optical-glass > canvas")).toBeAttached();
    const box = await card.evaluate(e => {
      const r = e.getBoundingClientRect(), c = e.querySelector(":scope > .optical-glass > canvas").getBoundingClientRect();
      return { top: c.top, bottom: c.bottom, expectedTop: Math.max(0, r.top), expectedBottom: Math.min(innerHeight, r.bottom), height: r.height };
    });
    expect(box.height).toBeGreaterThan(160);
    expect(Math.abs(box.top - box.expectedTop)).toBeLessThan(3);
    expect(Math.abs(box.bottom - box.expectedBottom)).toBeLessThan(3);
    await inspectGlass(page);
  }
  const sample = () => card.locator(":scope > .optical-glass > canvas").evaluate(c => c.toDataURL());
  const first = await sample(); await page.waitForTimeout(600); expect(await sample()).not.toBe(first);
  const headingY = await page.locator(".ranking-columns").evaluate(e => e.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo({ top: y - 115, behavior: "instant" }), headingY); await page.waitForTimeout(900);
  const padding = await page.locator(".ranking-columns > div").evaluateAll(cards => cards.map(e => {
    const r = e.getBoundingClientRect(), h = e.querySelector("h2").getBoundingClientRect();
    return { left: h.left - r.left, right: r.right - h.right, top: h.top - r.top, overflow: e.scrollWidth - e.clientWidth };
  }));
  for (const item of padding) { expect(item.left).toBeGreaterThanOrEqual(17); expect(item.right).toBeGreaterThanOrEqual(17); expect(item.top).toBeGreaterThanOrEqual(17); expect(item.overflow).toBeLessThanOrEqual(1); }
  await page.screenshot({ path: `test-results/glass-rankings-${width}.png` });
  await page.setViewportSize({ width: width === 390 ? 768 : width - 150, height: 800 });
  await page.waitForTimeout(250); await inspectGlass(page);
  await context.close();
});

test("heatmap fixed scale, contrasting labels, categorical legend and command portal optics", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
  await page.goto(origin + "/compare");
  await page.getByRole("button", { name: "Heatmap", exact: true }).click();
  await expect(page.locator(".score-heatmap-wrap .optical-output").first()).toBeAttached();
  const cells = await page.locator(".score-heatmap td:not(.heatmap-missing)").evaluateAll(items => items.map(e => ({ score: Number(e.textContent), bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color })));
  const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const cell of cells) {
    const expected = [30, 57, 84].map((v, i) => Math.round(v + ([91, 201, 173][i] - v) * cell.score / 100));
    const actual = cell.bg.match(/\d+/g).slice(0, 3).map(Number);
    actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1));
    const a = luminance(cell.bg), b = luminance(cell.fg);
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: "test-results/glass-heatmap.png" });
  await page.getByRole("button", { name: "Scatter", exact: true }).click();
  await expect(page.locator(".chart-series-legend span")).toHaveCount(await page.locator(".compare-dot").count());
  const colors = await page.locator(".compare-dot circle").evaluateAll(nodes => nodes.map(e => getComputedStyle(e).fill));
  expect(new Set(colors).size).toBeGreaterThan(4);
  await page.getByRole("button", { name: "Open command search" }).click();
  await expect(page.locator(".command-box .optical-output")).toBeAttached();
  await page.locator("[cmdk-input]").fill("Tata"); await expect(page.locator("[cmdk-item]").first()).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator(".command-box")).toHaveCount(0);
  await expect(page.locator("body > .glass-render-stage")).toHaveCount(1);
});

test("clear lens displaces the actual environment; context loss recovers cleanly", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
  const page = await context.newPage(); await page.goto(origin + "/rankings");
  await page.locator(".recommendation-result").scrollIntoViewIfNeeded();
  await expect(page.locator(".recommendation-result > .optical-glass > canvas")).toBeAttached();
  const pixels = await page.locator(".recommendation-result > .optical-glass > canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect(), environment = document.querySelector(".glass-material-backdrop");
    const sample = document.createElement("canvas"); sample.width = 160; sample.height = 80;
    const ctx = sample.getContext("2d");
    ctx.drawImage(environment, rect.left * environment.width / innerWidth, rect.top * environment.height / innerHeight, rect.width * environment.width / innerWidth, rect.height * environment.height / innerHeight, 0, 0, 160, 80);
    const before = ctx.getImageData(0, 0, 160, 80).data;
    ctx.clearRect(0, 0, 160, 80); ctx.drawImage(canvas, 0, 0, 160, 80);
    const after = ctx.getImageData(0, 0, 160, 80).data;
    let changed = 0, total = 0, n = 0;
    for (let y = 8; y < 72; y++) for (let x = 8; x < 152; x++) {
      const i = (y * 160 + x) * 4;
      const delta = (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2])) / 3;
      if (delta > 2) changed++; total += delta; n++;
    }
    return { changed, mean: total / n };
  });
  expect(pixels.changed).toBeGreaterThan(20); expect(pixels.mean).toBeLessThan(20);
  await page.evaluate(() => { window.__loss = document.querySelector(".glass-render-stage").getContext("webgl").getExtension("WEBGL_lose_context"); window.__loss.loseContext(); });
  await expect(page.locator("main")).toHaveAttribute("data-glass-support", "unavailable");
  await expect(page.locator(".optical-output")).toHaveCount(0);
  await page.evaluate(() => window.__loss.restoreContext());
  await expect(page.locator("main")).toHaveAttribute("data-glass-support", "optical");
  await expect(page.locator(".recommendation-result > .optical-glass > canvas")).toBeAttached();
  await expect(page.locator("body > .glass-render-stage")).toHaveCount(1);
  await context.close();
});
