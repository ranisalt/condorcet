<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.unexpected_error()} · {m.app_title()}</title>
</svelte:head>

<section class="error-page" aria-labelledby="error-heading">
  <h1 id="error-heading">{m.unexpected_error()}</h1>
  <a class="button" href={resolve("/")}>{m.nav_home()}</a>
</section>
