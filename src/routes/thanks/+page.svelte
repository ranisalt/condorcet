<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.thanks_title()} · {m.app_title()}</title>
</svelte:head>

<h1>{m.thanks_title()}</h1>
<p>{data.blank ? m.thanks_blank() : m.thanks_saved()}</p>
<p>{m.simulation_warning()}</p>
<nav aria-label={m.main_navigation()}>
  <a href={resolve("ballot")}>{m.edit_vote()}</a>
  <a href={resolve("results")}>{m.nav_results()}</a>
</nav>
