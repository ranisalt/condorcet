<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import favicon from "#lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";
  import "./layout.css";

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <title>{m.app_title()}</title>
  <meta name="description" content={m.simulation_warning()} />
  <link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main">{m.skip_to_content()}</a>
<header class="site-header">
  <a class="brand" href={resolve("/")} aria-label={m.app_title()}>
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="brand-name">{m.app_title()}</span>
  </a>
  <nav class="site-nav" aria-label={m.main_navigation()}>
    <a href={resolve("/")}>{m.nav_home()}</a>
    <a href={resolve("ballot")}>{m.nav_ballot()}</a>
    <a href={resolve("results")}>{m.nav_results()}</a>
    <a href={resolve("how-it-works")}>{m.nav_method()}</a>
  </nav>
</header>
<main id="main">
  {@render children?.()}
</main>
<footer class="site-footer">
  <a class="brand brand--footer" href={resolve("/")} aria-label={m.app_title()}>
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="brand-name">{m.app_title()}</span>
  </a>
  <p>{m.simulation_warning()}</p>
</footer>
