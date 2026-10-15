import { expect, test } from "@playwright/test";
import { openE2ED1, resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("shows public election status, count-only progress, and Google-only entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("main").getByText(/Esta é uma simulação para fins de estudo/),
  ).toBeVisible();
  await expect(page.getByText(/Usamos apenas o login com Google/)).toBeVisible();
  await expect(page.getByText("Votos válidos: 0")).toBeVisible();
  await expect(
    page.getByText(/Resultados disponíveis a partir de 10\.000 votos válidos/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await resetFixture({ validCount: 0, blankCount: 1 });
  await page.reload();
  await expect(page.getByText("Votos válidos: 0")).toBeVisible();
  await expect(page.getByText(/Votos em branco/)).toHaveCount(0);
});

test("shows ballot and logout entry controls for a signed-in account", async ({
  page,
  context,
}) => {
  await signInFixture(context, "test-voter");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Preparar meu voto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toHaveCount(0);
});

test("starts Google OAuth by native POST with a fixed callback and state cookie", async ({
  request,
}) => {
  const response = await request.post("/?/login", {
    form: {},
    headers: { Accept: "text/html", Origin: TEST_ORIGIN },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  const location = response.headers().location;
  expect(location).toBeDefined();
  const providerUrl = new URL(location ?? "", TEST_ORIGIN);
  expect(providerUrl.hostname).toBe("accounts.google.com");
  expect(providerUrl.searchParams.get("redirect_uri")).toBe(
    `${TEST_ORIGIN}/api/auth/callback/google`,
  );
  expect(providerUrl.searchParams.get("state")).toBeTruthy();
  expect(response.headers()["set-cookie"]).toContain("better-auth.state");

  const database = await openE2ED1();
  try {
    const users = await database.d1
      .prepare("SELECT count(*) AS count FROM user")
      .first<{ count: number }>();
    expect(users?.count).toBe(2);
  } finally {
    await database.dispose();
  }
});
