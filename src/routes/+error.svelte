<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.unexpected_error()} · {m.app_title()}</title>
</svelte:head>

<h1>{m.unexpected_error()}</h1>
<p><a href={resolve("/")}>{m.nav_home()}</a></p>
