import { test, expect } from "@playwright/test";

const origin = process.env.FERRUM_TEST_URL ?? "http://127.0.0.1:3000";
test.use({
  launchOptions: {
    executablePath: process.env.FERRUM_BROWSER_PATH ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader"],
  },
  viewport: { width: 1440, height: 1000 },
});
test.setTimeout(90000);

async function skipFirstVisit(page) {
  await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
}

async function disableWebGL(page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return String(kind).startsWith("webgl") ? null : getContext.call(this, kind, ...args);
    };
  });
}

async function expectEntered(page) {
  await expect(page.locator("html")).toHaveAttribute("data-entrance-state", "complete", { timeout: 15000 });
  await expect(page.locator(".cinematic-entrance")).toHaveCount(0);
  await expect(page.locator(".hero-data")).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.locator("main.app-shell").evaluate(el => el.inert)).toBe(false);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
}

test("fresh desktop visit shows the original artifact and Skip returns focus to usable research", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /hydration|hydrated|Minified React error #418/i.test(message.text())) errors.push(message.text());
  });
  await page.goto(origin);
  const artifact = page.getByRole("dialog", { name: "Ferrum Research" });
  await expect(artifact).toBeVisible();
  await expect(artifact).toHaveAttribute("data-entrance-ready", "true");
  await expect(page.getByRole("heading", { name: "Ferrum Research", exact: true })).toBeVisible();
  await expect.poll(() => page.locator("main.app-shell").evaluate(el => el.inert)).toBe(true);
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expectEntered(page);
  await expect(page.locator("html")).toHaveAttribute("data-desktop-motion", "active");
  await expect(page.locator("html")).toHaveAttribute("data-scroll-engine", "native");
  await expect(page.getByRole("link", { name: "Ferrum research home", exact: true })).toBeFocused();
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await expect(page).toHaveURL(origin + "/compare");
  await expect(page.locator("main.app-shell:visible .universe-table tbody tr")).toHaveCount(20);
  expect(errors).toEqual([]);
});

test("keyboard entry works when WebGL is unavailable", async ({ page }) => {
  await disableWebGL(page);
  await page.goto(origin);
  await expect(page.locator(".entrance-mineral-fallback")).toBeVisible();
  await page.locator(".cinematic-entrance").focus();
  await page.keyboard.press("Enter");
  await expectEntered(page);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("the original mineral loads its baked geometry and surface before replay", async ({ page }) => {
  const assets = new Set();
  page.on("response", response => {
    if (response.ok()) assets.add(new URL(response.url()).pathname);
  });
  await page.goto(origin);
  await expect(page.locator(".entrance-mineral.is-ready canvas")).toBeVisible({ timeout: 30000 });
  expect(assets.has("/ferrum-specimen.glb")).toBe(true);
  expect(assets.has("/ferrum-specimen-surface.png")).toBe(true);
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expectEntered(page);
  await page.getByRole("button", { name: "Replay the artifact" }).click();
  await expect(page.locator(".entrance-mineral.is-ready canvas")).toBeVisible({ timeout: 30000 });
});

test("changing scatter axes retargets the same interactive point", async ({ page }) => {
  await skipFirstVisit(page);
  await page.goto(origin + "/compare");
  await page.getByRole("button", { name: "Scatter", exact: true }).click();
  const point = page.locator(".compare-dot").first();
  const start = await point.evaluate(node => { window.ferrumTestMark = node; return node.style.transform; });
  await page.getByRole("combobox", { name: "X axis", exact: true }).selectOption("roce");
  await page.getByRole("combobox", { name: "X axis", exact: true }).selectOption("growth");
  await expect.poll(() => point.evaluate(node => node.style.transform)).not.toBe(start);
  expect(await point.evaluate(node => node === window.ferrumTestMark)).toBe(true);
  await point.focus();
  await expect(page.getByRole("tooltip")).toContainText("Growth score");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => point.evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(.001);
});

test("batched daily bars preserve every observed value and its hover target", async ({ page }) => {
  await skipFirstVisit(page);
  await page.goto(origin + "/companies/C01");
  const prices = await (await page.request.get(origin + "/api/v1/companies/C01/prices")).json();
  for (const [title, field, name] of [["Daily Volume", "volume", "Volume - price"], ["MACD", "macd_histogram", "MACD histogram"]]) {
    const chart = page.locator(".technical-chart").filter({ has: page.getByText(title, { exact: true }).first() });
    const records = prices.points.filter(point => point[field] != null && (field !== "macd_histogram" || point.macd != null));
    await chart.scrollIntoViewIfNeeded();
    const paths = chart.locator(".daily-histogram path");
    await expect(paths.first()).toBeAttached();
    expect(await paths.count()).toBeLessThanOrEqual(6);
    const screen = await paths.evaluateAll(nodes => {
      const centers = nodes.flatMap(node => Array.from(node.getAttribute("d").matchAll(/M([\d.-]+),[\d.-]+V[\d.-]+h([\d.]+)/g), m => Number(m[1]) + Number(m[2]) / 2)).sort((a, b) => a - b);
      const svg = nodes[0].ownerSVGElement;
      const target = new DOMPoint(centers[Math.floor(centers.length / 2)], 200).matrixTransform(svg.getScreenCTM());
      return { x: target.x, y: target.y, count: centers.length };
    });
    expect(screen.count).toBe(records.length);
    // Chromium dispatches whole CSS-pixel mouse coordinates. At full history each
    // trading day is ~1.6px wide, so truncating can select the previous session.
    await page.mouse.move(Math.round(screen.x), Math.round(screen.y));
    const tooltip = chart.getByRole("tooltip");
    await expect(tooltip).toContainText(name);
    const reading = records[Math.floor(records.length / 2)];
    await expect(tooltip).toContainText(reading.date.slice(0, 10));
    await expect(tooltip).toContainText(field === "volume" ? reading.volume.toLocaleString("en-IN") + " shares" : reading.macd_histogram.toFixed(2) + " indicator units");
  }
});

test("scrolling through the artifact completes its cinematic handoff", async ({ page }) => {
  await disableWebGL(page);
  await page.goto(origin);
  const artifact = page.locator(".cinematic-entrance");
  await expect(artifact).toBeVisible();
  await expect(artifact).toHaveAttribute("data-entrance-motion-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-scroll-engine", "native");
  await expect(page.locator("html")).toHaveAttribute("data-desktop-motion", "paused");
  await page.mouse.move(720, 480);
  await page.mouse.wheel(0, 1180);
  await expect.poll(() => artifact.evaluate(el => el.scrollTop)).toBeGreaterThan(900);
  await expect.poll(() => artifact.locator(".entrance-character").first().evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.8);
  await expect.poll(() => artifact.locator(".entrance-mineral-fallback").evaluate(el => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.hypot(matrix.m11, matrix.m12, matrix.m13);
  })).toBeGreaterThan(1.3);
  await page.mouse.wheel(0, 1650);
  await expectEntered(page);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
});

test("Escape safely finishes the artifact without an input or scroll lock", async ({ page }) => {
  await disableWebGL(page);
  await page.goto(origin);
  await expect(page.locator(".cinematic-entrance")).toBeVisible();
  await expect(page.locator(".cinematic-entrance")).toHaveAttribute("data-entrance-ready", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expectEntered(page);
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(150);
  await page.getByRole("button", { name: "Open command search" }).click();
  await expect(page.locator("[cmdk-input]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".command-box")).toHaveCount(0);
});

test("the artifact can be replayed after scrolling without resuming stale inertia", async ({ page }) => {
  await skipFirstVisit(page);
  await disableWebGL(page);
  await page.goto(origin);
  await expect(page.locator(".hero-data")).toBeVisible();
  const replay = page.locator("[data-replay-entrance]");
  await replay.scrollIntoViewIfNeeded();
  await replay.click();
  await expect(page.locator(".cinematic-entrance")).toBeVisible();
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expectEntered(page);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
  await expect(page.locator(".hero-copy h1")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("reduced motion retains the artifact and all research controls without animated gating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await expect(page.locator(".cinematic-entrance.is-reduced")).toBeVisible();
  await page.getByRole("button", { name: "Enter research", exact: true }).click();
  await expectEntered(page);
  await expect(page.locator("html")).toHaveAttribute("data-desktop-motion", "reduced");
  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page).toHaveURL(origin + "/rankings");
  await page.getByRole("tab", { name: "Momentum", exact: true }).click();
  await expect(page.locator(".recommendation-result h2")).toContainText("Shyam");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("rapid tab and view changes settle on the latest data and preserve comparison state", async ({ page }) => {
  await skipFirstVisit(page);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/rankings");
  for (const name of ["Income", "Momentum", "Value", "Overall Best Investment"]) {
    await page.getByRole("tab", { name, exact: true }).click();
  }
  await expect(page.locator(".recommendation-result h2")).toContainText("National Aluminium");
  await expect(page.getByRole("tab", { name: "Overall Best Investment", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await expect(page).toHaveURL(origin + "/compare");
  await page.locator(".company-check input").first().check();
  for (const name of ["Scatter", "Rank bars", "Heatmap", "Table"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.locator(".company-check input:checked")).toHaveCount(1);
  await expect(page.locator(".universe-table tbody tr")).toHaveCount(20);
  await page.getByRole("link", { name: "Companies", exact: true }).click();
  await expect(page).toHaveURL(origin + "/#company-universe");
  await expect.poll(() => page.locator("#company-universe").evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(70);
  await expect.poll(() => page.locator("#company-universe").evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThanOrEqual(160);
  expect(errors).toEqual([]);
});

test("repeated routes release their scroll and pointer listeners and leave a single live page", async ({ page }) => {
  await skipFirstVisit(page);
  await page.addInitScript(() => {
    const live = new Map();
    const tracked = new Set(["scroll", "wheel", "resize", "pointermove", "pointerdown", "mousemove", "mousedown"]);
    for (const [label, target] of [["window", window], ["document", document]]) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      target.addEventListener = (type, listener, options) => {
        if (tracked.has(type)) {
          const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
          const key = `${label}:${type}:${capture}`;
          if (!live.has(key)) live.set(key, new Set());
          live.get(key).add(listener);
        }
        return add(type, listener, options);
      };
      target.removeEventListener = (type, listener, options) => {
        if (tracked.has(type)) {
          const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
          live.get(`${label}:${type}:${capture}`)?.delete(listener);
        }
        return remove(type, listener, options);
      };
    }
    window.__ferrumListenerCount = () => [...live.values()].reduce((count, listeners) => count + listeners.size, 0);
  });
  await page.goto(origin + "/rankings");
  await expect(page.locator(".ranking-columns")).toBeVisible();
  const cycle = async () => {
    for (const [name, path, ready] of [["Compare", "/compare", ".comparison-controls"], ["Methodology", "/methodology", ".method-notes"], ["Rankings", "/rankings", ".ranking-columns"]]) {
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(origin + path);
      await expect(page.locator(ready)).toBeVisible();
    }
  };
  await cycle();
  const listeners = await page.evaluate(() => window.__ferrumListenerCount());
  const canvases = await page.locator("canvas").count();
  await cycle();
  await expect(page.locator("main.app-shell:visible")).toHaveCount(1);
  await expect(page.locator("#primary-navigation:visible")).toHaveCount(1);
  // Next keeps inactive routes in hidden Activity trees; only the live UI may run.
  await expect(page.locator(".ferrum-motion-ui:visible")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(canvases);
  await expect.poll(() => page.evaluate(() => window.__ferrumListenerCount())).toBeLessThanOrEqual(listeners + 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.mouse.wheel(0, -950);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
