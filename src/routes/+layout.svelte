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
  <a class="source-link" href="https://github.com/ranisalt/condorcet" aria-label={m.source_code()}>
    <svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" fill="currentColor"
      ><path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      /></svg
    >
  </a>
</footer>
