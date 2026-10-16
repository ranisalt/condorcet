<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.ack_title()} · {m.app_title()}</title>
</svelte:head>

<div class="acknowledgment-page">
  <header class="page-heading">
    <p class="eyebrow">{m[data.election.titleKey]()}</p>
    <h1>{m.ack_title()}</h1>
  </header>

  <section class="acknowledgment-card" aria-labelledby="ack-study-heading">
    <h2 id="ack-study-heading">{m.study_notice_title()}</h2>
    <p>{m.simulation_warning()}</p>
  </section>

  <section
    class="acknowledgment-card acknowledgment-card--privacy"
    aria-labelledby="ack-privacy-heading"
  >
    <h2 id="ack-privacy-heading">{m.privacy_heading()}</h2>
    <p>{m.privacy_warning()}</p>
    <p>{m.privacy_obfuscation()}</p>
    <p>{m.login_explanation()}</p>
  </section>

  <form class="acknowledgment-form" method="POST">
    <input type="hidden" name="electionId" value={data.election.id} />
    <label>
      <input type="checkbox" name="acknowledged" value="yes" required />
      <span>{m.ack_label()}</span>
    </label>
    {#if form?.required || form?.invalid}
      <p class="form-error" role="alert">{m.ack_required()}</p>
    {:else if form?.stale}
      <p class="form-error" role="alert">{m.stale_election()}</p>
    {/if}
    <button class="button button--primary" type="submit">{m.ack_continue()}</button>
  </form>
</div>
