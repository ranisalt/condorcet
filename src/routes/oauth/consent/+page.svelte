<script lang="ts">
  import { createClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";
  import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$app/env/public";
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
    missing_authorization_id:
      "This authorization link is incomplete. Go back to the app that asked you to sign in and try again.",
    api_error:
      "We could not complete the authorization. Go back to the app that asked you to sign in and try again.",
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
  <title>Authorize access · Condorcet</title>
</svelte:head>

<div class="oauth-consent-page">
  <section class="notice-card" aria-labelledby="oauth-consent-title">
    <h1 id="oauth-consent-title">Authorize access</h1>

    {#if view.kind === "loading"}
      <p role="status">Checking your sign-in…</p>
    {:else if view.kind === "signin"}
      <p>Sign in with Google to continue. Your sign-in is used only to authorize this request.</p>
      <button class="button button--primary" type="button" onclick={signIn}
        >Continue with Google</button
      >
    {:else if view.kind === "redirecting"}
      <p role="status">Authorization approved. Returning you to the app…</p>
    {:else}
      <p role="alert">{errorCopy[view.reason]}</p>
    {/if}
  </section>
</div>
