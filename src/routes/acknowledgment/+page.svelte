<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.ack_title()} · {m.app_title()}</title>
</svelte:head>

<h1>{m.ack_title()}</h1>
<p>{m.simulation_warning()}</p>
<p>{m.privacy_warning()}</p>
<p>{m.login_explanation()}</p>
<form method="POST">
  <input type="hidden" name="electionId" value={data.election.id} />
  <label>
    <input type="checkbox" name="acknowledged" value="yes" required />
    {m.ack_label()}
  </label>
  {#if form?.required || form?.invalid}
    <p role="alert">{m.ack_required()}</p>
  {/if}
  <button type="submit">{m.ack_continue()}</button>
</form>
