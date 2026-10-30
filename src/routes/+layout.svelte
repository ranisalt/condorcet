<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import logo from "#lib/assets/logo.svg";
  import type { LayoutProps } from "./$types";
  import "./layout.css";

  let { children }: LayoutProps = $props();

  const title = $derived(m.app_title());
  const titleSplit = $derived(title.lastIndexOf(" "));
</script>

{#snippet brandContent()}
  <img class="brand-mark" src={logo} alt="" width="28" height="28" />
  <span class="brand-name"
    >{#if titleSplit > 0}<span class="brand-prefix">{title.slice(0, titleSplit + 1)}</span
      >{title.slice(titleSplit + 1)}{:else}{title}{/if}</span
  >
{/snippet}

<svelte:head>
  <title>{m.app_title()}</title>
  <meta name="description" content={m.simulation_warning()} />
  <link rel="icon" href={logo} />
</svelte:head>

<a class="skip-link" href="#main">{m.skip_to_content()}</a>
<header class="site-header">
  <a class="brand" href={resolve("/")} aria-label={m.app_title()}>
    {@render brandContent()}
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
    {@render brandContent()}
  </a>
  <p>{m.simulation_warning()}</p>
</footer>
