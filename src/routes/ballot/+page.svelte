<script lang="ts">
  import { resolve } from "$app/paths";
  import Ballot from "#lib/components/Ballot.svelte";
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
    form !== null &&
      "error" in form &&
      (form.error === "invalid" ||
        form.error === "closed" ||
        form.error === "stale" ||
        form.error === "save")
      ? form.error
      : undefined,
  );
  const unsaved = $derived(form !== null && "draft" in form);
</script>

<svelte:head>
  <title>{m.ballot_title()} · {m.app_title()}</title>
</svelte:head>

{#if !data.signedIn}
  <div class="ballot-page">
    <header class="page-heading">
      <h1>{m.ballot_signed_out_heading()}</h1>
      <p>{m.ballot_signed_out_body()}</p>
    </header>
    <form method="POST" action="/?/login">
      <button type="submit" class="button button--primary">{m.sign_in()}</button>
    </form>
    <section class="notice-card" aria-labelledby="ballot-steps-heading">
      <h2 id="ballot-steps-heading">{m.ballot_steps_heading()}</h2>
      <ol>
        <li>{m.ballot_step_sign_in()}</li>
        <li>{m.ballot_step_acknowledge()}</li>
        <li>{m.ballot_step_rank()}</li>
      </ol>
      <p>{m.login_explanation()}</p>
      <p><a href="{resolve('how-it-works')}#privacidade">{m.home_privacy_link()}</a></p>
    </section>
  </div>
{:else if initialDraft !== null}
  {#key initialDraft}
    <Ballot election={data.election} {initialDraft} open={data.open} {error} {unsaved} />
  {/key}
{/if}
