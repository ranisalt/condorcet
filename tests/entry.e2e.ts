import { expect, test } from "@playwright/test";
import { resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
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
  await expect(page.getByText(/O login usa apenas o Google/)).toBeVisible();
  await expect(page.getByText("0 de 10.000 votos válidos", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Os resultados aparecem a partir de 10\.000 votos válidos/),
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
  test(`starts Supabase OIDC on the request origin ${origin} with a transaction cookie`, async ({
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
    expect(`${providerUrl.origin}${providerUrl.pathname}`).toBe(
      "https://test-project.supabase.co/auth/v1/oauth/authorize",
    );
    expect(providerUrl.searchParams.get("client_id")).toBe("test-client");
    expect(providerUrl.searchParams.get("redirect_uri")).toBe(`${origin}/auth/callback`);
    expect(providerUrl.searchParams.get("state")).toBeTruthy();
    expect(providerUrl.searchParams.get("nonce")).toBeTruthy();
    expect(providerUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(response.headers()["set-cookie"]).toContain("oidc_tx=");
  });
}

test("rejects cross-origin login form posts", async ({ request }) => {
  // SvelteKit only enforces its CSRF origin check outside dev.
  test.skip(process.env.E2E_PREVIEW !== "1", "CSRF checks are disabled by vite dev");
  const response = await request.post("/?/login", {
    form: {},
    headers: { Accept: "text/html", Origin: "https://untrusted.example.invalid" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
});
