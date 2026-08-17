import { test, expect, type Page } from "@playwright/test";

// Read-only smoke tests against a running instance (local dev server or a
// deployed environment via E2E_BASE_URL). Requires E2E_EMAIL/E2E_PASSWORD
// for an existing agency user — no data is created or modified.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run smoke tests.");

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", EMAIL!);
  await page.fill("#password", PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
}

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("login redirects to dashboard with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await login(page);
  await expect(page.locator('h1:has-text("Επισκόπηση")')).toBeVisible();
  expect(errors).toEqual([]);
});

const NAV_PAGES: { path: string; heading: string }[] = [
  { path: "/dashboard/clients", heading: "Πελάτες" },
  { path: "/dashboard/policies", heading: "Συμβόλαια" },
  { path: "/dashboard/claims", heading: "Ζημιές" },
  { path: "/dashboard/commissions", heading: "Προμήθειες" },
  { path: "/dashboard/tickets", heading: "Αιτήματα" },
  { path: "/dashboard/installments", heading: "δόσεις" },
  { path: "/dashboard/tasks", heading: "Υπενθυμίσεις" },
  { path: "/dashboard/tasks/calendar", heading: "Ημερολόγιο" },
  { path: "/dashboard/reports", heading: "Αναφορές" },
  { path: "/dashboard/reports/production", heading: "Παραγωγή Αναλυτικά" },
  { path: "/dashboard/reports/production-summary", heading: "Παραγωγή Συγκεντρωτικά" },
  { path: "/dashboard/settings", heading: "Ρυθμίσεις" },
];

for (const { path, heading } of NAV_PAGES) {
  test(`${path} loads without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await login(page);
    await page.goto(path);
    await expect(page.locator(`h1:has-text("${heading}")`).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
