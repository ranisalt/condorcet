# Simulador Condorcet

A pt-BR ranked-voting study simulation, built with SvelteKit 3, Svelte 5, Google-only Better Auth, Drizzle, and Cloudflare Workers/D1.

**Not an official election, representative poll, or prediction. Votes are not anonymous.** Preferences are account-linked, readable by the operator, and potentially accessible to Cloudflare. Random candidate IDs provide obfuscation, not encryption.

## Local setup

Use pnpm and Node 24+ (native TypeScript execution is used by test helpers).

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run db:migrate
pnpm run gen
pnpm run dev
```

The all-zero D1 ID in `wrangler.jsonc` is local-only. Local migrations need no Cloudflare credentials; do not deploy the placeholder configuration.

Configure these variables privately, never committing values:

| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `ORIGIN`               | Exact application origin, including the development port |
| `BETTER_AUTH_SECRET`   | Cryptographically random production auth secret          |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                   |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                               |

Register `<ORIGIN>/api/auth/callback/google` as a Google authorized redirect URI for each intended origin. `localhost` and `127.0.0.1` are different origins. Password authentication and cross-provider linking are disabled; Google accounts do not guarantee one human/one vote.

Authentication retains the email and provider account identifier needed to recognize returning accounts. Database hooks leave Better Auth's required name field empty, discard avatars, and discard Google access/refresh/ID tokens on both creation and update. This minimizes stored profile data; it does not anonymize ballots.

For deliberate schema changes, generate and inspect SQL before applying it:

```sh
pnpm run auth:schema
pnpm run db:generate
pnpm run db:migrate
pnpm run gen
```

Fresh checkouts normally apply committed migrations, not generate new ones. Do not hand-edit generated auth/Worker types.

## Election and ballot rules

`src/lib/server/elections.json` selects at most one election by UUID and contains all ticket metadata, including vice names/parties. Candidate names are not stored in voting tables. Review the sourced roster against the official first-round slate before opening publicly; direct TSE publication access was unavailable during planning.

- Selecting an election opens it immediately. `closesAt: null` means no closing time determined; otherwise use timezone-qualified ISO 8601, preferably UTC with `Z`. The server refuses writes at/after closing, though a request admitted just before closing may finish afterward.
- Freeze the UUID, roster, and unique 8-bit IDs before the first submission. Correcting a live slate requires a new UUID. Switching selected UUID preserves previous data but v1 has no archive UI.
- `resultsThreshold` initially equals `10000` and is configurable.
- Signed-in users acknowledge privacy/simulation warnings before receiving ballot data. Initial unranked order is shuffled once; saved rankings are restored.
- Add/remove/reorder operations remain unsaved until explicit submission. Native forms also support JavaScript-disabled editing.
- Ranked tickets beat all omitted tickets; omitted tickets tie for last. No ties between selected positions.
- One D1 atomic batch updates submitted status, deletes only that account/election's old ranks, and inserts replacement ranks. Failure rolls back the whole operation; no old ranking history is retained.

| Current state                                  | Valid participation/threshold/aggregation | Eligible for unlocked results | Separate blank count |
| ---------------------------------------------- | ----------------------------------------- | ----------------------------- | -------------------- |
| Never submitted, including acknowledgment-only | No                                        | No                            | No                   |
| Submitted nonempty ranking                     | Yes, once                                 | Yes                           | No                   |
| Submitted empty ranking or withdrew to empty   | No                                        | Yes                           | Yes                  |

Only **current nonempty ballots** count toward participation, thresholds, and percentage denominators. Blank statistics reflect current empty submissions, not cumulative save events. Repeated saves do not create extra voters.

Public progress contains valid participation and the configured threshold. Every results request requires prior submission and enough nonempty ballots. Withdrawal can relock results; information already viewed cannot be revoked. Results show directional pairwise counts/percentages and a strict Condorcet winner only if a ticket beats every opponent; ties/cycles produce no winner, not a fallback method or full ranking. Opposing percentages can sum below 100% because omitted tickets tie. Results refresh on navigation/reload, without polling.

## Validation

```sh
pnpm run check
pnpm exec vitest run
pnpm run test:e2e
RUN_PERF=1 pnpm exec vitest run --project server src/lib/server/results.performance.spec.ts
pnpm run lint
pnpm run build
```

Repository tests use disposable real local D1 for ownership, rollback, and concurrent saves. Browser fixtures use synthetic identities and real signed database-backed Better Auth sessions in isolated `.wrangler/e2e` state, without an application auth bypass. They **do not prove a real Google consent/code exchange**. Never point fixture reset tools at production.

After building, run core browser flows against the built local Worker:

```sh
E2E_PREVIEW=1 pnpm exec playwright test tests/auth-smoke.e2e.ts tests/acknowledgment.e2e.ts tests/ballot-saving.e2e.ts tests/results.e2e.ts
```

Authored TypeScript remains strict. Generated framework JavaScript is not recursively type-checked through Wrangler's generated `mainModule` import; handwritten JavaScript/config remains linted. Focused lint rules reject explicit `any`, loose equality, raw Svelte HTML, and implicit button types.

## Public-launch prerequisites

Local implementation is not a compliance certificate. Before collecting real political preferences:

1. Confirm the official candidate/vice roster and freeze IDs.
2. Resolve privacy terms, retention/contact, account deletion, and backup erasure. These are deliberately deferred; acknowledgment alone is insufficient.
3. Supply a real D1 ID and production secrets; register Google redirects.
4. Back up and explicitly verify the target before migrations. The following is an **operator-only production command**, not normal local setup or authorization for an agent to run it:

   ```sh
   pnpm exec wrangler d1 migrations apply DB --remote
   ```

5. Read back the intended production DB to verify migration effects, then perform Google login → acknowledge → save → logout → same-account login → restored-ranking checks.

Never log ballots, identities, session tokens, or OAuth tokens. Ownership comes from authenticated server state, never hidden user IDs. Personalized HTML/data must never enter a shared cache.

All UI copy lives in `messages/pt-br.json`. Agent plans, credentials, local database state, generated Paraglide/build output, reports, and coverage are ignored, not versioned. Commits remain local unless pushing is explicitly requested.
