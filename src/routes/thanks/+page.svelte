<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.thanks_title()} · {m.app_title()}</title>
</svelte:head>

<div class="thanks-page">
  <section class="thanks-card" aria-labelledby="thanks-heading">
    <p class="eyebrow">{m.election_br_2026_title()}</p>
    <h1 id="thanks-heading">{m.thanks_title()}</h1>
    <p class="thanks-message" role="status">{data.blank ? m.thanks_blank() : m.thanks_saved()}</p>
    <nav class="thanks-actions" aria-label={m.main_navigation()}>
      <a class="button button--primary" href={resolve("ballot")}>{m.edit_vote()}</a>
      <a class="button" href={resolve("results")}>{m.nav_results()}</a>
    </nav>
  </section>
</div>
