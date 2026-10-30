<script lang="ts">
  import { createClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";
  import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$app/env/public";
  import { m } from "#lib/paraglide/messages.js";
  import {
    approvePendingAuthorization,
    resolveAuthorizationId,
    startGoogleSignIn,
    type ConsentFailureReason,
  } from "#lib/consent.ts";

  type View =
    | { kind: "loading" }
    | { kind: "signin" }
    | { kind: "redirecting" }
    | { kind: "error"; reason: ConsentFailureReason };

  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let view = $state<View>({ kind: "loading" });

  const errorCopy: Record<ConsentFailureReason, string> = {
    missing_authorization_id: m.consent_error_missing_authorization_id(),
    api_error: m.consent_error_api_error(),
  };

  onMount(async () => {
    const authorizationId = resolveAuthorizationId(
      sessionStorage,
      new URL(location.href).searchParams.get("authorization_id"),
    );
    if (!authorizationId) {
      view = { kind: "error", reason: "missing_authorization_id" };
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      view = { kind: "error", reason: "api_error" };
      return;
    }
    if (!data.session) {
      view = { kind: "signin" };
      return;
    }

    const outcome = await approvePendingAuthorization(
      supabase.auth,
      sessionStorage,
      authorizationId,
      (url) => {
        view = { kind: "redirecting" };
        location.assign(url);
      },
    );
    if (!outcome.ok) view = { kind: "error", reason: outcome.reason };
  });

  async function signIn() {
    const outcome = await startGoogleSignIn(supabase.auth, location.origin);
    if (!outcome.ok) view = { kind: "error", reason: outcome.reason };
  }
</script>

<svelte:head>
  <title>{m.consent_page_title()}</title>
</svelte:head>

<div class="oauth-consent-page">
  <section class="notice-card" aria-labelledby="oauth-consent-title">
    <h1 id="oauth-consent-title">{m.consent_title()}</h1>

    {#if view.kind === "loading"}
      <p role="status">{m.consent_loading()}</p>
    {:else if view.kind === "signin"}
      <p>{m.consent_sign_in_intro()}</p>
      <button class="button button--primary" type="button" onclick={signIn}>{m.sign_in()}</button>
    {:else if view.kind === "redirecting"}
      <p role="status">{m.consent_redirecting()}</p>
    {:else}
      <p role="alert">{errorCopy[view.reason]}</p>
    {/if}
  </section>
</div>
