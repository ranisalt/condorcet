<script lang="ts">
  import Ballot from "#lib/components/Ballot.svelte";
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
</script>

<svelte:head>
  <title>{m.ballot_title()} · {m.app_title()}</title>
</svelte:head>

{#if !data.open}
  <p role="status">{m.election_closed()}</p>
{/if}
{#key initialDraft}
  <Ballot election={data.election} {initialDraft} open={data.open} {error} />
{/key}
