import { expect, test } from "@playwright/test";

test("legal pages are publicly reachable", async ({ page }) => {
  for (const path of ["/terms", "/privacy", "/contact"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("private pages redirect anonymous users to login", async ({ page }) => {
  await page.goto("/tasting-notes");
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("private APIs reject anonymous users", async ({ request }) => {
  const submit = await request.post("/api/submit", { data: { wineName: "Test" } });
  expect(submit.status()).toBe(401);

  const image = await request.get("/api/images/uploads/example.jpg");
  expect(image.status()).toBe(401);
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response).toBeOK();
});
