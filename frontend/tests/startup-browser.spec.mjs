import { test, expect } from "@playwright/test";

test.use({
  launchOptions: { executablePath: process.env.FERRUM_BROWSER_PATH ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" },
  viewport: { width: 1440, height: 1000 },
});
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ferrum:entrance:seen:v1", "1"));
});

const port = process.env.FERRUM_TEST_PORT ?? "3001";
const routes = [
  ["/", ".hero-data"], ["/compare", ".comparison-controls"], ["/rankings", ".ranking-columns"],
  ["/methodology", ".source-inventory details"], ["/sector", ".story-sections"],
  ["/intelligence", ".intel-controls"], ["/companies/C01", ".visual-kpi"],
];

for (const host of ["127.0.0.1", "localhost"]) {
  for (const [path, ready] of routes) test(`Brave ${host}${path}: site and research load on one origin`, async ({ page }) => {
    const origin = `http://${host}:${port}`;
    const requests = [];
    const errors = [];
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/v1/")) requests.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    // A browser-side connection to the API port must not be needed.
    await page.route("http://127.0.0.1:8000/**", route => route.abort());
    await page.goto(origin + path);
    await expect(page.locator(ready).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("RESEARCH TEMPORARILY UNAVAILABLE", { exact: true })).toHaveCount(0);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(url => new URL(url).origin === origin)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("same-origin proxy preserves POST request validation and real API failures", async ({ request }) => {
  const origin = `http://127.0.0.1:${port}`;
  const invalid = await request.post(origin + "/api/v1/intelligence/companies/C01/research-updates", { data: { question: [] } });
  expect(invalid.status()).toBe(422);
  const missing = await request.get(origin + "/api/v1/companies/C99");
  expect(missing.status()).toBe(404);
});
