# Simulador Condorcet

A Brazilian Portuguese (pt-BR) ranked-voting simulation for study purposes. Voters sign in with Google, rank the tickets of one election, and can edit or withdraw their ballot until the election closes. Once enough people vote, everyone who voted can compare how Condorcet-style methods pick a winner.

**This is not an official election, a representative poll, or a prediction.** Read [Privacy](#privacy) before collecting real preferences.

Built with SvelteKit, Svelte 5, Drizzle and Cloudflare Workers with D1 (Cloudflare's SQLite database). Sign-in goes through [Supabase Auth](https://supabase.com/docs/guides/auth) acting as an OAuth 2.1 / OpenID Connect provider.

## How sign-in works

```
browser ──▶ condorcet /?/login ──▶ Supabase /oauth/authorize
                                         │
           condorcet /oauth/consent ◀────┘  (Google sign-in + approve, runs in the browser)
                                         │
browser ──▶ condorcet /auth/callback ◀───┘  (code exchange, server-side)
                 │
                 └─▶ verifies the ID token, keeps only `sub`, sets a signed `voter` cookie
```

1. The **login** action (`src/routes/+page.server.ts`) starts an OpenID Connect authorization-code flow with PKCE, `state` and `nonce`. It stores them in a short-lived signed `oidc_tx` cookie.
2. Supabase sends the browser to the app's **consent page** (`/oauth/consent`). That page uses `supabase-js` to sign in with Google, approves the request, then signs out of Supabase.
3. The **callback** (`/auth/callback`) exchanges the code using the client secret. It verifies the ES256 ID token against Supabase's published keys and checks issuer, audience, expiry and nonce.
4. The app keeps **only the Supabase user UUID** (`sub`). It discards the access and refresh tokens. The voter cookie is HMAC-signed, `HttpOnly`, `SameSite=Lax` and lasts one day. Sessions are stateless, so there is no server-side revocation inside that day.

The implementation is about 200 lines with no auth library: `src/lib/server/oidc.ts` and `src/lib/server/voter-session.ts`.

## Privacy

What the ballot database stores: a Supabase user UUID, the election ID, acknowledgment and submission times, and the ranked candidate IDs. It stores no email, name, avatar or Google identifier.

What it does **not** guarantee:

- **Ballots are not anonymous.** Supabase holds the link from UUID to Google account. Whoever controls both the Supabase project and the D1 database can join them. You must trust the operator.
- Cloudflare can read D1, and Supabase can read its own data.
- One Google account is one voter, but one person can own several Google accounts.
- Candidate IDs are random to avoid accidental ordering bias; they are not encryption.

The Supabase project strips identity from the tokens this app receives with a [custom access token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook). For OAuth-server tokens it blanks `email` and `phone` and drops `user_metadata` and `app_metadata`:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare c jsonb := event->'claims';
begin
  if event->>'authentication_method' = 'oauth_provider/authorization_code'
     or c ? 'client_id' then
    c := (c - 'user_metadata' - 'app_metadata')
         || jsonb_build_object('email', '', 'phone', '');
  end if;
  return jsonb_build_object('claims', c);
end $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

Never log ballots, voter IDs, cookies or tokens. Personalized pages must never enter a shared cache; `src/lib/server/private-response.ts` marks them private.

## Local setup

You need Node 24+ (test helpers run TypeScript natively) and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
cp .env.example .env        # then fill in the values below
pnpm run db:migrate         # applies drizzle/ migrations to a local D1
pnpm run dev                # http://localhost:5173
```

The all-zero database ID in `wrangler.jsonc` only works locally. Local migrations need no Cloudflare credentials.

### Supabase project

1. Enable the **OAuth 2.1 server** and set the authorization path to `/oauth/consent`.
2. Set the **Site URL** to the deployed origin, e.g. `https://condorcet.rsa.sh`. Supabase sends every authorization request to `<Site URL>/oauth/consent`, so local sign-ins also approve on the deployed consent page before returning to the local callback. For a fully local flow, use a separate Supabase project.
3. Register a **confidential** OAuth client with redirect URIs `https://<your-domain>/auth/callback` and `http://localhost:5173/auth/callback`. Use `client_secret_basic` authentication.
4. Enable the **Google** provider and disable the others (email/password included).
5. Install the hook above and enable it under **Auth → Hooks → Customize Access Token**.

### Environment variables

| Variable                          | When            | Secret | Purpose                                                                                     |
| --------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | build (inlined) | no     | Supabase project URL, e.g. `https://<ref>.supabase.co`. The OIDC issuer is derived from it. |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build (inlined) | no     | Lets the consent page call Supabase from the browser.                                       |
| `OIDC_CLIENT_ID`                  | build (inlined) | no     | The OAuth client registered above.                                                          |
| `OIDC_CLIENT_SECRET`              | runtime         | yes    | The OAuth client's secret.                                                                  |
| `SESSION_SECRET`                  | runtime         | yes    | HMAC key for the signed cookies. Generate with `openssl rand -base64 48`.                   |

Build-time values are read from `.env` or the build environment and compiled into the bundle, so anyone can check them in the deployed code. Runtime secrets never enter the bundle. Rotating `SESSION_SECRET` signs everyone out.

The app takes its origin from each request (`event.url.origin`), so no origin variable is needed and custom domains work as-is. `localhost` and `127.0.0.1` are different origins; register each one you use.

## Deploying to Cloudflare

1. Create a D1 database and put its ID in `wrangler.jsonc`.
2. In the Worker's **Build → Variables**, set the three build-time variables.
3. Set the runtime secrets:

   ```sh
   pnpm exec wrangler secret put SESSION_SECRET
   pnpm exec wrangler secret put OIDC_CLIENT_SECRET
   ```

4. Back up and verify the target, then apply migrations. This is an operator-only production command:

   ```sh
   pnpm exec wrangler d1 migrations apply DB --remote
   ```

5. Check the real flow: sign in with Google → acknowledge → save → sign out → sign in again → the saved ranking comes back.

Before collecting real preferences, also confirm the official candidate roster and settle privacy terms, retention, contact and account deletion. The acknowledgment screen alone is not enough.

## Election and ballot rules

`src/lib/server/elections.json` selects at most one election by UUID and holds all ticket metadata, including vice-presidential names and parties. Voting tables store candidate IDs only.

- Selecting an election opens it immediately. `closesAt: null` means no closing time; otherwise use a timezone-qualified ISO 8601 time, preferably UTC with `Z`. Writes are refused at or after closing, though a request admitted just before may finish after.
- Freeze the UUID, roster and unique 8-bit candidate IDs before the first submission. Fixing a live slate needs a new UUID. Switching UUIDs keeps old data, but there is no archive UI.
- `resultsThreshold` is the number of valid ballots needed before results unlock (`10000` by default).
- Signed-in voters acknowledge the privacy and simulation warnings before they see the ballot. The initial order is shuffled once; saved rankings are restored.
- Adding, removing and reordering stay unsaved until the voter submits. Plain HTML forms make this work without JavaScript.
- Ranked tickets beat every unranked ticket; unranked tickets tie for last. Ranked positions cannot tie.
- Each save is one atomic D1 batch: mark submitted, delete that voter's old ranks for the election, insert the new ones. A failure rolls everything back. No history is kept.

| Current state                                   | Counts as valid participation | Can see unlocked results | Counted as blank |
| ----------------------------------------------- | ----------------------------- | ------------------------ | ---------------- |
| Never submitted (including acknowledgment only) | No                            | No                       | No               |
| Submitted a nonempty ranking                    | Yes, once                     | Yes                      | No               |
| Submitted an empty ranking, or withdrew         | No                            | Yes                      | Yes              |

Only **current nonempty ballots** count toward participation, the threshold and percentages. Saving again never adds a voter. Withdrawing can relock results, though nobody can unsee what they already saw. Results refresh on navigation or reload; there is no polling.

## Result methods

The strict Condorcet status names a winner only if one ticket beats every other head-to-head. A tie or a cycle leaves it without a winner. A selector then compares:

- **Copeland:** head-to-head wins minus losses; ties score zero. Everyone with the top score shares the result.
- **Schulze (beatpath):** winning-votes variant. A path is as strong as its weakest link; a candidate wins if no one has a stronger path back to them. All unbeaten candidates share the result.
- **Ranked Pairs (Tideman):** lock victories from the largest margin down (then by winning votes), skipping any that would create a cycle. Exactly tied strengths try every locking order, so all possible winners are kept instead of breaking ties by ID. The search is bounded to keep the Worker safe; if it cannot finish, the page says the result is undetermined.

The matrix shows signed margins: row-over-column votes minus column-over-row votes. Positive favors the row, negative the column, zero is a tie. Blank ballots never enter any calculation. Switching methods uses plain links and works without JavaScript.

## Testing

```sh
pnpm run check          # Worker types + svelte-check
pnpm run lint           # prettier + eslint
pnpm exec vitest run    # unit and component tests, against a real local D1
pnpm run test:e2e       # Playwright against a local dev server
pnpm run build
RUN_PERF=1 pnpm exec vitest run --project server src/lib/server/results.performance.spec.ts
```

`pnpm run test` runs Vitest and then Playwright.

Unit tests use a disposable local D1 to check ownership, rollback and concurrent saves. The OIDC client is tested against locally generated ES256 keys and a fake token endpoint.

End-to-end tests run in an isolated `.wrangler/e2e` state with fake build values (`test-project.supabase.co`, `test-client`). They sign voters in by minting a voter cookie with the test `SESSION_SECRET`, so they **do not exercise a real Supabase or Google sign-in**. Never point the fixture reset helpers at production.

To run browser flows against the built Worker instead of the dev server, build with the same fake values first. This run also covers SvelteKit's CSRF origin check, which `vite dev` skips:

```sh
PUBLIC_SUPABASE_URL=https://test-project.supabase.co \
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
OIDC_CLIENT_ID=test-client \
pnpm run build
E2E_PREVIEW=1 pnpm exec playwright test
```

## Project notes

- All UI copy lives in `messages/pt-br.json` (Paraglide).
- For schema changes, edit `src/lib/server/db/`, then run `pnpm run db:generate`, review the SQL in `drizzle/`, and run `pnpm run db:migrate`. Do not hand-edit generated Worker types; regenerate them with `pnpm run gen`.
- Ignored and never committed: `.env`, local database state, agent plans, build output, reports and coverage.
