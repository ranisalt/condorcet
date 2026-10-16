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
    page.getByRole("contentinfo").getByText(/Esta é uma simulação para fins de estudo/),
  ).toBeVisible();
  await expect(page.getByText(/O acesso é feito apenas pelo Google/)).toBeVisible();
  await expect(page.getByText("0 de 10.000 votos válidos", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Resultados disponíveis a partir de 10\.000 votos válidos/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await resetFixture({ validCount: 0, blankCount: 1 });
  await page.reload();
  await expect(page.getByText("0 de 10.000 votos válidos", { exact: true })).toBeVisible();
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

for (const origin of [TEST_ORIGIN, "http://127.0.0.1:4173"]) {
  test(`starts Google OAuth on the request origin ${origin} with a state cookie`, async ({
    request,
  }) => {
    const response = await request.post("/?/login", {
      form: {},
      headers: {
        Accept: "text/html",
        Host: new URL(origin).host,
        Origin: origin,
        "X-Forwarded-Host": "untrusted.example.invalid",
        "X-Forwarded-Proto": "https",
      },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    const location = response.headers().location;
    expect(location).toBeDefined();
    const providerUrl = new URL(location ?? "", TEST_ORIGIN);
    expect(providerUrl.hostname).toBe("accounts.google.com");
    expect(providerUrl.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
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
}

test("rejects cross-origin authentication requests carrying a session", async ({ context }) => {
  await signInFixture(context, "test-voter");
  const response = await context.request.post("/api/auth/sign-in/social", {
    headers: { Origin: "https://untrusted.example.invalid" },
    data: { provider: "google", callbackURL: "/ballot" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
});
