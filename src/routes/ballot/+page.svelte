<script lang="ts">
  import { resolve } from "$app/paths";
  import Ballot from "#lib/components/Ballot.svelte";
  import { isBallotError } from "#lib/components/ballot-error.ts";
  import FlowSteps from "#lib/components/FlowSteps.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  const initialDraft = $derived(
    !data.signedIn
      ? null
      : form !== null && "draft" in form
        ? (form.draft ?? data.draft)
        : data.draft,
  );
  const error = $derived(
    form !== null && "error" in form && isBallotError(form.error) ? form.error : undefined,
  );
  const unsaved = $derived(form !== null && "draft" in form);
</script>

<svelte:head>
  <title>{m.ballot_title()} · {m.app_title()}</title>
</svelte:head>

{#if !data.signedIn}
  <div class="signin-page">
    <FlowSteps current={1} />
    <header class="signin-heading">
      <h1>{m.ballot_signed_out_heading()}</h1>
      <p>{m.ballot_signed_out_body()}</p>
    </header>
    <form method="POST" action="/?/login">
      <button type="submit" class="button button--primary button--large">
        {m.sign_in()}
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"
          ><path
            d="M3 8h10M9 4l4 4-4 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
      </button>
    </form>
    <div class="signin-facts">
      <section aria-labelledby="signin-login-heading">
        <h2 id="signin-login-heading">{m.ballot_signed_out_login_heading()}</h2>
        <p>{m.ballot_signed_out_login_body()}</p>
      </section>
      <section aria-labelledby="signin-privacy-heading">
        <h2 id="signin-privacy-heading">{m.privacy_heading()}</h2>
        <p>{m.ballot_signed_out_privacy_body()}</p>
        <p><a href="{resolve('how-it-works')}#privacidade">{m.home_privacy_link()}</a></p>
      </section>
    </div>
  </div>
{:else if initialDraft !== null}
  {#key initialDraft}
    <Ballot election={data.election} {initialDraft} open={data.open} {error} {unsaved} />
  {/key}
{/if}
