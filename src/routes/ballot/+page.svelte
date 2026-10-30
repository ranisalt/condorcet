<script lang="ts">
  import Ballot from "#lib/components/Ballot.svelte";
  import CandidateTicket from "#lib/components/CandidateTicket.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  const initialDraft = $derived(
    form !== null && "draft" in form ? (form.draft ?? data.draft) : data.draft,
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

{#if initialDraft === null}
  <section class="readonly-roster">
    <p class="eyebrow">{m[data.election.titleKey]()}</p>
    <h1>{m.ballot_title()}</h1>
    {#if data.open}
      <h2>{m.ballot_signed_out_heading()}</h2>
      <p>{m.ballot_signed_out_body()}</p>
      <form method="POST" action="/?/login">
        <button type="submit" class="button button--primary">{m.sign_in()}</button>
      </form>
    {:else}
      <p role="status">{m.ballot_signed_out_closed()}</p>
    {/if}
    <ul aria-label={m.ballot_title()}>
      {#each data.election.candidates as candidate (candidate.id)}
        <li><CandidateTicket {candidate} /></li>
      {/each}
    </ul>
  </section>
{:else}
  {#key initialDraft}
    <Ballot election={data.election} {initialDraft} open={data.open} {error} {unsaved} />
  {/key}
{/if}
